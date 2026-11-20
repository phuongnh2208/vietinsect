#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

process.env.ES_SPECIMENS_INDEX_OVERRIDE = "specimens_bench";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const knex = require("../src/config/knex");
const pool = require("../src/config/db");
const app = require("../app");
const { JWT_SECRET } = require("../src/config/jwt");
const { esClient } = require("../src/config/elasticsearch");
const { toSpecimenDoc } = require("../src/modules/search/elasticsearch.service");
const { closeRateLimiterRedis } = require("../src/middleware/rateLimiter");

const BENCH_INDEX = "specimens_bench";
const MAPPING_PATH = path.resolve(__dirname, "../../infra/elasticsearch/mappings/specimens.json");
const REPORT_PATH = path.resolve(__dirname, "../../docs/audit/bench-es.md");

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
}

function summarize(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return {
    count: s.length,
    min: Number((s[0] || 0).toFixed(2)),
    p50: percentile(s, 50),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: Number((s[s.length - 1] || 0).toFixed(2)),
  };
}

const QUERY_POOL = [
  "Papilio demoleus",
  "Papilio",
  "Lepidoptera",
  "Coleoptera",
  "Hymenoptera",
  "Diptera",
  "Hemiptera",
  "Odonata",
  "Orthoptera",
  "bo canh cung",
  "bọ cánh cứng",
  "buom phuong",
  "bướm phượng",
  "chuon chuon",
  "chuồn chuồn",
  "kien",
  "ong",
  "Ha Noi",
  "Hà Nội",
  "Lam Dong",
  "Lâm Đồng",
  "Cuc Phuong",
  "Cúc Phương",
  "Tam Dao",
  "Tam Đảo",
  "Bach Ma",
  "Cat Tien",
  "Dak Lak",
  "Lao Cai",
  "Papilio polytes",
  "Graphium sarpedon",
  "Danaus chrysippus",
  "Junonia almana",
  "Pieris canidia",
  "Catopsilia pomona",
  "Euploea core",
  "VAST",
  "GBIF",
  "Viet Nam",
  "rung nhiet doi",
];

async function main() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
  await esClient.indices.delete({ index: BENCH_INDEX }).catch(() => {});
  await esClient.indices.create({ index: BENCH_INDEX, ...mapping });

  let totalIndexed = 0;
  const reindexStart = Date.now();
  try {
    // 1. Reindex all dev specimens in chunks of 2,000
    const batchSize = 2000;
    let lastId = 0;
    while (true) {
      const rows = await knex({ s: "specimens" })
        .join({ sr: "specimen_registry" }, "s.specimen_id", "sr.specimen_id")
        .join({ t1: "taxa" }, "s.taxon_id", "t1.taxon_id")
        .leftJoin({ t2: "taxa" }, "t1.parent_id", "t2.taxon_id")
        .leftJoin({ t3: "taxa" }, "t2.parent_id", "t3.taxon_id")
        .leftJoin({ t4: "taxa" }, "t3.parent_id", "t4.taxon_id")
        .leftJoin({ p: "provinces" }, "s.province_id", "p.province_id")
        .where("s.specimen_id", ">", lastId)
        .orderBy("s.specimen_id", "asc")
        .limit(batchSize)
        .select(
          "s.specimen_id",
          "sr.specimen_code",
          "sr.basis_of_record",
          "sr.recorded_by",
          "sr.occurrence_remarks",
          "s.taxon_id",
          "t1.scientific_name as taxon_name",
          "t1.vernacular_name_vn as taxon_vernacular_vn",
          "t1.vernacular_name_en as taxon_vernacular_en",
          "s.gbif_scientific_name",
          "s.common_name_vn",
          "s.common_name_en",
          knex.raw(`COALESCE(
            CASE WHEN t1.taxon_rank = 'Order' THEN t1.scientific_name END,
            CASE WHEN t2.taxon_rank = 'Order' THEN t2.scientific_name END,
            CASE WHEN t3.taxon_rank = 'Order' THEN t3.scientific_name END,
            CASE WHEN t4.taxon_rank = 'Order' THEN t4.scientific_name END
          ) AS order_name`),
          knex.raw(`COALESCE(
            CASE WHEN t1.taxon_rank = 'Family' THEN t1.scientific_name END,
            CASE WHEN t2.taxon_rank = 'Family' THEN t2.scientific_name END,
            CASE WHEN t3.taxon_rank = 'Family' THEN t3.scientific_name END
          ) AS family_name`),
          knex.raw(`COALESCE(
            CASE WHEN t1.taxon_rank = 'Genus' THEN t1.scientific_name END,
            CASE WHEN t2.taxon_rank = 'Genus' THEN t2.scientific_name END
          ) AS genus_name`),
          "s.province_id",
          "p.province_name_vn",
          "p.province_name_en",
          "s.district",
          "s.commune",
          "s.locality_detail",
          "s.notes",
          "s.is_public",
          "s.deleted_at",
          "s.collection_date",
          "s.created_at",
          "s.updated_at",
          knex.raw("ST_Y(s.collection_point::geometry) AS latitude"),
          knex.raw("ST_X(s.collection_point::geometry) AS longitude"),
        );

      if (!rows.length) break;
      lastId = Number(rows[rows.length - 1].specimen_id);

      const ops = rows.flatMap((r) => {
        const doc = toSpecimenDoc(r);
        return [{ index: { _index: BENCH_INDEX, _id: String(doc.specimen_id) } }, doc];
      });
      await esClient.bulk({ operations: ops, refresh: false });
      totalIndexed += rows.length;
    }

    await esClient.indices.refresh({ index: BENCH_INDEX });
    const reindexSec = Number(((Date.now() - reindexStart) / 1000).toFixed(2));
    const stats = await esClient.indices.stats({ index: BENCH_INDEX });
    const sizeBytes = stats._all.primaries.store.size_in_bytes || 0;
    const sizeMb = Number((sizeBytes / (1024 * 1024)).toFixed(2));

    // Fetch a real specimen_code to include in query pool
    const sampleCode = await knex("specimen_registry").select("specimen_code").first();
    const queries = [...QUERY_POOL];
    if (sampleCode?.specimen_code) queries.push(sampleCode.specimen_code);

    const admin = await knex("admin_users").select("admin_id", "username").first();
    const adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    // 2. Cold query (first hit before warm-up)
    const coldStart = performance.now();
    const coldRes = await request(app).get(`/api/search/specimens?q=${encodeURIComponent(queries[0])}`);
    const coldE2eMs = Number((performance.now() - coldStart).toFixed(2));
    const coldEsMs = Number(coldRes.body?.tookMs ?? 0);

    // 3. Warm-up (10 queries)
    for (let i = 0; i < 10; i++) {
      await request(app).get(`/api/search/specimens?q=${encodeURIComponent(queries[i % queries.length])}`);
    }

    // 4. 200 queries for User (Public) & 200 queries for Admin
    const userEs = [];
    const userE2e = [];
    for (let i = 0; i < 200; i++) {
      const q = queries[i % queries.length];
      const t0 = performance.now();
      const res = await request(app).get(`/api/search/specimens?q=${encodeURIComponent(q)}`);
      userE2e.push(performance.now() - t0);
      userEs.push(Number(res.body?.tookMs ?? 0));
    }

    const adminEs = [];
    const adminE2e = [];
    for (let i = 0; i < 200; i++) {
      const q = queries[i % queries.length];
      const t0 = performance.now();
      const res = await request(app)
        .get(`/api/search/specimens?q=${encodeURIComponent(q)}`)
        .set("Authorization", `Bearer ${adminToken}`);
      adminE2e.push(performance.now() - t0);
      adminEs.push(Number(res.body?.tookMs ?? 0));
    }

    const uEs = summarize(userEs);
    const uE2e = summarize(userE2e);
    const aEs = summarize(adminEs);
    const aE2e = summarize(adminE2e);

    const passSrs = uE2e.p95 < 1000 && aE2e.p95 < 1000;

    const md = `# Benchmark Elasticsearch 8 (specimens_bench)

- **Ngày chạy:** ${new Date().toISOString()}
- **Script:** \`backend/scripts/bench-es.js\`
- **Tổng số document reindex từ DB dev:** **${totalIndexed.toLocaleString("en-US")}**
- **Thời gian reindex:** **${reindexSec}s** (batch 2.000 doc/lần)
- **Kích thước index (\`specimens_bench\`):** **${sizeMb} MB**
- **Truy vấn Cold (lần đầu trước warm-up):** ES \`took\` = **${coldEsMs} ms**, End-to-End API = **${coldE2eMs} ms**
- **Ngưỡng SRS (§5.1):** P95 < 1.000 ms → **${passSrs ? "ĐẠT" : "KHÔNG ĐẠT"}**

## Kết quả 200 truy vấn đa dạng (sau 10 warm-up)

| Vai trò | Lớp đo | Số truy vấn | Min (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|---|---|---:|---:|---:|---:|---:|---:|
| **User (Public)** | ES \`took\` | ${uEs.count} | ${uEs.min} | ${uEs.p50} | **${uEs.p95}** | ${uEs.p99} | ${uEs.max} |
| **User (Public)** | API End-to-End | ${uE2e.count} | ${uE2e.min} | ${uE2e.p50} | **${uE2e.p95}** | ${uE2e.p99} | ${uE2e.max} |
| **Admin** | ES \`took\` | ${aEs.count} | ${aEs.min} | ${aEs.p50} | **${aEs.p95}** | ${aEs.p99} | ${aEs.max} |
| **Admin** | API End-to-End | ${aE2e.count} | ${aE2e.min} | ${aE2e.p50} | **${aE2e.p95}** | ${aE2e.p99} | ${aE2e.max} |

> Index tạm \`specimens_bench\` đã được xóa sạch sau khi kết thúc benchmark.
`;

    fs.writeFileSync(REPORT_PATH, md, "utf8");
    console.log(JSON.stringify({ totalIndexed, reindexSec, sizeMb, coldEsMs, coldE2eMs, uEs, uE2e, aEs, aE2e, passSrs }, null, 2));
  } finally {
    await esClient.indices.delete({ index: BENCH_INDEX }).catch(() => {});
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
