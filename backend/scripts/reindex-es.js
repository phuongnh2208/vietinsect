#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const knex = require("../src/config/knex");
const { reindexAll } = require("../src/modules/search/elasticsearch.service");

async function main() {
  const start = Date.now();
  console.log("Bắt đầu đồng bộ toàn bộ dữ liệu PostgreSQL → Elasticsearch...");
  const result = await reindexAll({ batchSize: 1000, refresh: true });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(
    `Hoàn tất reindex trong ${elapsed}s: taxa=${result.taxaIndexed}, specimens=${result.specimensIndexed}`,
  );
  await knex.destroy();
}

main().catch(async (err) => {
  console.error("Reindex thất bại:", err.message);
  await knex.destroy();
  process.exit(1);
});
