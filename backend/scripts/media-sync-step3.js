#!/usr/bin/env node
/**
 * backend/scripts/media-sync-step3.js
 * Bước 3 – Đồng bộ ảnh bảo mật từ GBIF/iNaturalist vào MinIO nội bộ:
 * - Kiểm tra license của TỪNG ẢNH (multimedia.license ∈ {CC0, CC BY, CC BY-SA})
 * - Ảnh NC/ND/UNKNOWN: KHÔNG tải, KHÔNG nhúng nguồn ngoài
 * - Whitelist host + chặn IP nội bộ/redirect + stream <=10MB + magic bytes + SHA-256 dedupe
 * - Bỏ EXIF bản Public + sinh thumbnail 200x200 (sharp limitInputPixels)
 * - Đẩy es_sync_outbox + xuất danh sách image_id mới ra --rollback-out để hoàn tác
 * - Idempotent, hỗ trợ --dry-run, --limit <N>, --order <Order>
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const https = require("https");
const axios = require("axios");
let sharp = null;
try { sharp = require("sharp"); } catch (_) {}
const knex = require("../src/config/knex");
const { ensureMediaBucket, putObjectToMinio } = require("../src/config/minio");
const {
  MAX_INPUT_PIXELS,
  classifyImageLicense,
  toWhitelistedLargeUrl,
  safeDownloadImage,
} = require("./lib/mediaSecurity");

const httpsAgent = new https.Agent({ keepAlive: false, family: 4 });
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ORDER_NAME = (() => { const i = args.indexOf("--order"); return i !== -1 ? args[i + 1] : "Blattodea"; })();
const LIMIT = (() => { const i = args.indexOf("--limit"); return i !== -1 ? parseInt(args[i + 1], 10) : 20; })();
const ROLLBACK_OUT = (() => { const i = args.indexOf("--rollback-out"); return i !== -1 ? args[i + 1] : null; })();

const ORDER_KEYS = {
  coleoptera: 1470, lepidoptera: 797, hymenoptera: 1457, diptera: 811,
  hemiptera: 809, orthoptera: 1458, odonata: 789, blattodea: 800,
  mantodea: 788, neuroptera: 1501, trichoptera: 1003, ephemeroptera: 1225,
  plecoptera: 787, thysanoptera: 1228, dermaptera: 1224, phasmida: 1460,
};

const LICENSE_CODE_DB = { "CC0": "cc0", "CC BY": "cc-by", "CC BY-SA": "cc-by-sa" };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function processImageBuffers(rawBuf) {
  if (!sharp) {
    return { mainBuf: rawBuf, thumbBuf: rawBuf, contentType: "image/jpeg" };
  }
  // Bỏ EXIF cho bản Public (không gọi .withMetadata()) + limitInputPixels
  const mainBuf = await sharp(rawBuf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .jpeg({ quality: 85 })
    .toBuffer();

  const thumbBuf = await sharp(rawBuf, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(200, 200, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();

  return { mainBuf, thumbBuf, contentType: "image/jpeg" };
}

async function main() {
  const taxonKey = ORDER_KEYS[ORDER_NAME.toLowerCase()];
  if (!taxonKey) throw new Error(`Unknown order: ${ORDER_NAME}`);

  console.log(`📸 Step 3 Secure Media Sync | Order=${ORDER_NAME} | Limit=${LIMIT} | Mode=${DRY_RUN ? "DRY-RUN" : "PRODUCTION"}`);

  if (!DRY_RUN) {
    await ensureMediaBucket();
  }

  // Load 1-1 lookup gbif_occurrence_id -> specimen_id
  const regRows = await knex("specimen_registry as sr")
    .join("specimens as s", "s.specimen_id", "sr.specimen_id")
    .whereNull("s.deleted_at")
    .whereNotNull("sr.gbif_occurrence_id")
    .select("sr.specimen_id", "sr.gbif_occurrence_id");
  const occToSpecimenId = new Map(regRows.map((r) => [String(r.gbif_occurrence_id), Number(r.specimen_id)]));

  const existingPhotoIds = new Set(
    (await knex("specimen_images").whereNotNull("external_photo_id").select("external_photo_id"))
      .map((r) => String(r.external_photo_id))
  );
  const seenHashes = new Set();

  const { data } = await axios.get("https://api.gbif.org/v1/occurrence/search", {
    params: { taxonKey, country: "VN", mediaType: "StillImage", hasCoordinate: true, limit: 300 },
    httpsAgent,
    timeout: 20000,
    headers: { "User-Agent": "VietInsect-Media-Sync/2.0 (vietinsect.vast.vn)" },
  });

  const stats = {
    downloaded: 0,
    totalBytesMain: 0,
    totalBytesThumb: 0,
    skipped_license_nc_nd_unknown: 0,
    skipped_non_whitelisted_url: 0,
    skipped_no_specimen_match: 0,
    skipped_duplicate: 0,
    skipped_hash_dedupe: 0,
    errors: 0,
  };
  const newImageIds = [];

  for (const occ of data.results || []) {
    if (stats.downloaded >= LIMIT) break;
    const occKey = occ.occurrenceID ? String(occ.occurrenceID) : (occ.gbifID ? `gbif:${occ.gbifID}` : null);
    const specimenId = occKey ? occToSpecimenId.get(occKey) : null;
    if (!specimenId) { stats.skipped_no_specimen_match++; continue; }

    const mediaItem = (occ.media || []).find((m) => m.type === "StillImage" && m.identifier);
    if (!mediaItem) continue;

    // 1. Kiểm tra license CỦA TỪNG ẢNH (multimedia.license)
    const { license, canDownloadToMinio } = classifyImageLicense(mediaItem.license);
    if (!canDownloadToMinio) {
      stats.skipped_license_nc_nd_unknown++;
      continue;
    }

    // 2. Kiểm tra whitelist host + đổi sang kích thước large
    const largeUrl = toWhitelistedLargeUrl(mediaItem.identifier);
    if (!largeUrl) {
      stats.skipped_non_whitelisted_url++;
      continue;
    }

    // 3. Idempotent check
    const extPhotoId = `gbif-media:${occ.gbifID}:0`;
    if (existingPhotoIds.has(extPhotoId)) {
      stats.skipped_duplicate++;
      continue;
    }

    if (DRY_RUN) {
      stats.downloaded++;
      continue;
    }

    try {
      const dl = await safeDownloadImage(largeUrl);
      if (seenHashes.has(dl.sha256)) {
        stats.skipped_hash_dedupe++;
        continue;
      }
      seenHashes.add(dl.sha256);

      const { mainBuf, thumbBuf, contentType } = await processImageBuffers(dl.buffer);
      const mainKey = `specimens/${specimenId}/gbif-${occ.gbifID}-large.jpg`;
      const thumbKey = `specimens/${specimenId}/gbif-${occ.gbifID}-thumb200.jpg`;

      await putObjectToMinio(mainKey, mainBuf, contentType);
      await putObjectToMinio(thumbKey, thumbBuf, contentType);

      const creator = mediaItem.creator || mediaItem.rightsHolder || occ.recordedBy || "Contributor";
      const publisher = mediaItem.publisher || occ.institutionCode || "iNaturalist";
      const attribution = `© ${creator} · ${license} · ${publisher}`.slice(0, 500);
      const sourceUrl = mediaItem.references || occ.references || `https://www.gbif.org/occurrence/${occ.gbifID}`;

      await knex.transaction(async (trx) => {
        const [ins] = await trx("specimen_images")
          .insert({
            specimen_id: specimenId,
            object_key: mainKey,
            thumbnail_key: thumbKey,
            shot_type: occ.basisOfRecord === "PRESERVED_SPECIMEN" ? "habitus" : "field",
            file_size_bytes: mainBuf.length,
            license_code: LICENSE_CODE_DB[license] || "cc-by",
            attribution,
            source_url: String(sourceUrl).slice(0, 500),
            external_photo_id: extPhotoId,
            source_provider: "MINIO",
            is_public: true,
          })
          .returning("image_id");

        newImageIds.push(Number(ins.image_id ?? ins));

        await trx("es_sync_outbox").insert({
          entity_type: "specimen",
          entity_id: specimenId,
          op: "upsert",
          priority: 1,
          status: "pending",
        });
      });

      existingPhotoIds.add(extPhotoId);
      stats.downloaded++;
      stats.totalBytesMain += mainBuf.length;
      stats.totalBytesThumb += thumbBuf.length;
    } catch (err) {
      stats.errors++;
      console.log(`   ⚠️ Skip gbif:${occ.gbifID}: ${err.message}`);
    }

    await sleep(300);
  }

  if (ROLLBACK_OUT && newImageIds.length > 0) {
    fs.writeFileSync(ROLLBACK_OUT, newImageIds.join("\n") + "\n", "utf8");
    console.log(`📝 Wrote ${newImageIds.length} new image_id(s) to ${ROLLBACK_OUT}`);
  }

  console.log("📊 STEP 3 SUMMARY:", JSON.stringify({
    ...stats,
    totalMB: ((stats.totalBytesMain + stats.totalBytesThumb) / (1024 * 1024)).toFixed(2),
    sharpEnabled: Boolean(sharp),
  }, null, 2));

  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 Fatal:", err.message);
  knex.destroy().finally(() => process.exit(1));
});
