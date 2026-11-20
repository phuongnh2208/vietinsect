#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const knex = require("../src/config/knex");
const { refreshTaxonViewNow } = require("../src/modules/taxonomy/mvRefresh.util");

async function main() {
  const start = Date.now();
  const ok = await refreshTaxonViewNow();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  if (ok) {
    const row = await knex("mv_taxon_dwc_flat").count("* as cnt").first();
    console.log(`Đã refresh mv_taxon_dwc_flat (${row.cnt} dòng) trong ${elapsed}s.`);
  } else {
    process.exitCode = 1;
  }
  await knex.destroy();
}

main().catch(async (err) => {
  console.error(err);
  await knex.destroy();
  process.exit(1);
});
