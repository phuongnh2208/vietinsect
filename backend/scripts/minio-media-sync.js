#!/usr/bin/env node
/**
 * backend/scripts/minio-media-sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pipeline đồng bộ Hình ảnh Côn trùng Việt Nam chuẩn Bản quyền Mở vào MinIO nội bộ:
 *   1. Truy vấn GBIF Multimedia / iNaturalist Open Data tại Việt Nam (country=VN, mediaType=StillImage)
 *   2. KIỂM SOÁT GIẤY PHÉP NGHIÊM NGẶT (SRS §6.2):
 *      - CHỈ nhận: cc0, cc-by, cc-by-sa, cc-by-nc, cc-by-nc-sa
 *      - TỪ CHỐI TUYỆT ĐỐI: null, all-rights-reserved, cc-by-nd, cc-by-nc-nd
 *   3. Ưu tiên khớp 1-1 theo gbif_occurrence_id trong specimen_registry, fallback theo loài tại VN
 *   4. Tải ảnh medium + thumbnail lưu thẳng vào cụm MinIO nội bộ (bucket: vietinsect-media)
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

require("dotenv").config();
const https = require("https");
const axios = require("axios");
const knex = require("../src/config/knex");
const { ensureMediaBucket, putObjectToMinio } = require("../src/config/minio");
const { ALLOWED_MEDIA_LICENSES } = require("../src/modules/media/media.constants");

const gbifAgent = new https.Agent({ keepAlive: false, family: 4 });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_IMAGES = (() => {
  const i = args.indexOf("--max");
  return i !== -1 ? parseInt(args[i + 1], 10) : 48;
})();
const ORDER_FILTER = (() => {
  const i = args.indexOf("--order");
  return i !== -1 ? args[i + 1].split(",").map((s) => s.trim().toLowerCase()) : null;
})();
const PER_ORDER_ARG = (() => {
  const i = args.indexOf("--per-order");
  return i !== -1 ? parseInt(args[i + 1], 10) : null;
})();
const EXACT_ONLY = args.includes("--exact-only");

const TARGET_ORDERS = [
  { order: "Lepidoptera", taxonKey: 797 },
  { order: "Coleoptera", taxonKey: 1470 },
  { order: "Odonata", taxonKey: 789 },
  { order: "Hymenoptera", taxonKey: 1457 },
  { order: "Diptera", taxonKey: 811 },
  { order: "Hemiptera", taxonKey: 809 },
  { order: "Orthoptera", taxonKey: 1458 },
  { order: "Blattodea", taxonKey: 800 },
  { order: "Mantodea", taxonKey: 788 },
  { order: "Neuroptera", taxonKey: 1501 },
  { order: "Trichoptera", taxonKey: 1003 },
  { order: "Ephemeroptera", taxonKey: 1225 },
  { order: "Plecoptera", taxonKey: 787 },
  { order: "Thysanoptera", taxonKey: 1228 },
  { order: "Dermaptera", taxonKey: 1224 },
  { order: "Phasmida", taxonKey: 1460 },
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Chuẩn hóa chuỗi/URL license từ GBIF/Creative Commons về mã chuẩn hệ thống.
 * Trả về null nếu chứa 'nd' (No-Derivatives) hoặc không phải Creative Commons mở.
 */
function normalizeLicense(rawLicense) {
  if (!rawLicense) return null;
  const s = String(rawLicense).toLowerCase();

  if (s.includes("by-nd") || s.includes("by-nc-nd") || s.includes("all rights reserved")) {
    return null;
  }
  if (s.includes("zero") || s.includes("cc0") || s.includes("publicdomain")) return "cc0";
  if (s.includes("by-nc-sa")) return "cc-by-nc-sa";
  if (s.includes("by-nc")) return "cc-by-nc";
  if (s.includes("by-sa")) return "cc-by-sa";
  if (s.includes("/by/") || s === "cc-by" || s.startsWith("cc by")) return "cc-by";
  return null;
}

/**
 * Chuyển URL gốc iNaturalist S3 (/original.jpg ~5MB) sang bản /medium.jpg (~500px) và /small.jpg (~240px)
 * để tối ưu dung lượng lưu trữ MinIO và hiển thị nhanh trên lưới Masonry.
 */
function deriveImageUrls(identifierUrl) {
  const u = String(identifierUrl || "").trim();
  if (u.includes("inaturalist-open-data.s3.amazonaws.com/photos/") || u.includes("static.inaturalist.org/photos/")) {
    return {
      mediumUrl: u.replace(/\/(original|large|square)\./, "/medium."),
      thumbUrl: u.replace(/\/(original|large|medium|square)\./, "/small."),
    };
  }
  return { mediumUrl: u, thumbUrl: u };
}

async function loadSpecimenLookups() {
  log("📋 Đang nạp index mẫu vật Việt Nam (gbif_occurrence_id + tên khoa học)...");
  const rows = await knex({ s: "specimens" })
    .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
    .whereNull("s.deleted_at")
    .where("s.is_public", true)
    .select("s.specimen_id", "sr.gbif_occurrence_id", "s.gbif_scientific_name");

  const byOccId = new Map();
  const byBinomial = new Map();
  const byGenus = new Map();

  for (const r of rows) {
    const id = Number(r.specimen_id);
    if (r.gbif_occurrence_id) {
      byOccId.set(String(r.gbif_occurrence_id), id);
    }
    if (r.gbif_scientific_name) {
      const words = r.gbif_scientific_name.trim().split(/\s+/);
      if (words.length >= 2) {
        const bin = `${words[0]} ${words[1]}`.toLowerCase();
        if (!byBinomial.has(bin)) byBinomial.set(bin, id);
      }
      if (words.length >= 1) {
        const gen = words[0].toLowerCase();
        if (!byGenus.has(gen)) byGenus.set(gen, id);
      }
    }
  }

  log(`   → Index sẵn sàng: ${byOccId.size.toLocaleString()} mã GBIF occurrence & ${byBinomial.size.toLocaleString()} loài.`);
  return { byOccId, byBinomial, byGenus };
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 18000,
    signal: AbortSignal.timeout(18000),
    headers: { "User-Agent": "VietInsect-MinIO-Archiver/1.0 (vietinsect.vast.vn)" },
  });
  return {
    buffer: Buffer.from(res.data),
    contentType: res.headers["content-type"] || "image/jpeg",
  };
}

async function main() {
  log("📸 VietInsect Open-License Media Sync → Local MinIO Object Storage");
  log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "PRODUCTION"} | Target: ${MAX_IMAGES} ảnh`);

  if (!DRY_RUN) {
    await ensureMediaBucket();
    log("✅ Bucket MinIO nội bộ 'vietinsect-media' sẵn sàng.");
  }

  const lookup = await loadSpecimenLookups();
  const activeOrders = ORDER_FILTER
    ? TARGET_ORDERS.filter((o) => ORDER_FILTER.includes(o.order.toLowerCase()))
    : TARGET_ORDERS;
  const perOrder = PER_ORDER_ARG || Math.max(8, Math.ceil(MAX_IMAGES / activeOrders.length));
  const effectiveMax = PER_ORDER_ARG ? PER_ORDER_ARG * activeOrders.length : MAX_IMAGES;

  let uploaded = 0;
  let skippedLicense = 0;
  let skippedDup = 0;
  let exactMatched = 0;

  for (const { order, taxonKey } of activeOrders) {
    if (uploaded >= effectiveMax) break;

    log(`\n🦋 [${order}] Truy vấn ảnh mẫu vật tại Việt Nam từ GBIF Multimedia...`);
    let results = [];
    try {
      const { data } = await axios.get("https://api.gbif.org/v1/occurrence/search", {
        params: {
          taxonKey,
          country: "VN",
          mediaType: "StillImage",
          hasCoordinate: true,
          limit: perOrder * 4,
        },
        timeout: 20000,
        signal: AbortSignal.timeout(20000),
        httpsAgent: gbifAgent,
        headers: { "User-Agent": "VietInsect-MinIO-Archiver/1.0" },
      });
      results = data?.results || [];
    } catch (err) {
      log(`   ⚠️ Lỗi gọi GBIF Multimedia (${order}): ${err.message}`);
      continue;
    }

    let orderUploaded = 0;
    for (const occ of results) {
      if (uploaded >= effectiveMax || orderUploaded >= perOrder) break;

      const mediaArr = occ.media || [];
      const mediaItem = mediaArr.find((m) => m.type === "StillImage" && m.identifier);
      if (!mediaItem) continue;

      const license = normalizeLicense(mediaItem.license || occ.license);
      if (!license || !ALLOWED_MEDIA_LICENSES.includes(license)) {
        skippedLicense++;
        continue;
      }

      // 1. Ưu tiên khớp 1-1 theo occurrenceID / gbifID
      const occKey1 = occ.occurrenceID ? String(occ.occurrenceID) : null;
      const occKey2 = occ.gbifID ? `gbif:${occ.gbifID}` : null;
      let specimenId =
        (occKey1 && lookup.byOccId.get(occKey1)) ||
        (occKey2 && lookup.byOccId.get(occKey2)) ||
        null;

      if (specimenId) {
        exactMatched++;
      } else if (!EXACT_ONLY) {
        const sci = occ.species || occ.genus || occ.scientificName || "";
        const words = sci.trim().split(/\s+/);
        if (words.length >= 2) {
          specimenId = lookup.byBinomial.get(`${words[0]} ${words[1]}`.toLowerCase()) || null;
        }
        if (!specimenId && words[0]) {
          specimenId = lookup.byGenus.get(words[0].toLowerCase()) || null;
        }
      }

      if (!specimenId) continue;

      const extPhotoId = `gbif-media:${occ.gbifID}:0`;
      const dup = await knex("specimen_images").where("external_photo_id", extPhotoId).first();
      if (dup) {
        skippedDup++;
        continue;
      }

      const { mediumUrl, thumbUrl } = deriveImageUrls(mediaItem.identifier);

      if (DRY_RUN) {
        uploaded++;
        orderUploaded++;
        continue;
      }

      try {
        const medImg = await downloadBuffer(mediumUrl);
        const thumbImg =
          thumbUrl !== mediumUrl ? await downloadBuffer(thumbUrl) : medImg;

        const mainKey = `specimens/${specimenId}/gbif-${occ.gbifID}-medium.jpg`;
        const thumbKey =
          thumbUrl !== mediumUrl
            ? `specimens/${specimenId}/gbif-${occ.gbifID}-thumb.jpg`
            : mainKey;

        await putObjectToMinio(mainKey, medImg.buffer, medImg.contentType);
        if (thumbKey !== mainKey) {
          await putObjectToMinio(thumbKey, thumbImg.buffer, thumbImg.contentType);
        }

        const holder = mediaItem.rightsHolder || mediaItem.creator || occ.recordedBy || "Contributor";
        const attribution = `© ${holder} · ${license.toUpperCase()}`.slice(0, 500);

        await knex("specimen_images").insert({
          specimen_id: specimenId,
          object_key: mainKey,
          thumbnail_key: thumbKey,
          shot_type: occ.basisOfRecord === "PRESERVED_SPECIMEN" ? "habitus" : "field",
          file_size_bytes: medImg.buffer.length,
          license_code: license,
          attribution,
          source_url: occ.references || `https://www.gbif.org/occurrence/${occ.gbifID}`,
          external_photo_id: extPhotoId,
          source_provider: "MINIO",
          is_public: true,
        });

        uploaded++;
        orderUploaded++;
      } catch (err) {
        log(`   ⚠️ Không tải được ảnh gbif:${occ.gbifID}: ${err.message}`);
      }

      await sleep(200);
    }

    log(`   ✅ [${order}] Lưu thành công +${orderUploaded} ảnh vào MinIO (Lũy kế: ${uploaded})`);
  }

  const [{ cnt }] = await knex("specimen_images").count("* as cnt");
  log(`\n${"═".repeat(62)}`);
  log(`🎉 HOÀN TẤT ĐỒNG BỘ MEDIA VÀO MINIO: +${uploaded} ảnh (${exactMatched} khớp 1-1 mã GBIF)`);
  log(`   Loại bỏ do bản quyền chặt/ND: ${skippedLicense} | Bỏ qua trùng: ${skippedDup}`);
  log(`📊 Tổng số ảnh đang lưu trên MinIO (specimen_images): ${Number(cnt).toLocaleString()}`);
  log(`${"═".repeat(62)}`);

  await knex.destroy();
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  knex.destroy().finally(() => process.exit(1));
});
