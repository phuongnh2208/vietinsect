"use strict";

require("dotenv").config();
const path = require("path");
const { Client } = require("pg");
const Knex = require("knex");
const bcrypt = require("bcrypt");

const TEST_DB = process.env.DB_TEST_NAME || "vietinsect_test";

module.exports = async function globalSetup() {
  const adminClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: "postgres",
    user: process.env.DB_USER || "vietinsect_user",
    password: process.env.DB_PASSWORD,
  });

  await adminClient.connect();
  try {
    await adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB],
    );
    await adminClient.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminClient.query(`CREATE DATABASE "${TEST_DB}"`);
  } finally {
    await adminClient.end();
  }

  const knex = Knex({
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      database: TEST_DB,
      user: process.env.DB_USER || "vietinsect_user",
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: path.resolve(__dirname, "../../database/migrations"),
      tableName: "knex_migrations",
    },
  });

  try {
    await knex.raw("CREATE EXTENSION IF NOT EXISTS postgis");
    await knex.migrate.latest();

    // Seed minimal test fixtures
    const passwordHash = await bcrypt.hash("Admin@Test1234", 10);
    await knex("admin_users").insert({
      username: "admin_test",
      password_hash: passwordHash,
      full_name: "Test Administrator",
      email: "admin_test@vietinsect.vn",
    });

    await knex("provinces").insert([
      {
        province_code: "HN",
        province_name_vn: "Hà Nội",
        province_name_en: "Hanoi",
        province_type: "city",
        region: "Bắc",
      },
      {
        province_code: "LD",
        province_name_vn: "Lâm Đồng",
        province_name_en: "Lam Dong",
        province_type: "province",
        region: "Trung",
      },
    ]);

    const [kingdom] = await knex("taxa")
      .insert({ taxon_rank: "Kingdom", scientific_name: "Animalia", slug: "animalia" })
      .returning("taxon_id");
    const [phylum] = await knex("taxa")
      .insert({
        parent_id: kingdom.taxon_id ?? kingdom,
        taxon_rank: "Phylum",
        scientific_name: "Arthropoda",
        slug: "arthropoda",
      })
      .returning("taxon_id");
    const [cls] = await knex("taxa")
      .insert({
        parent_id: phylum.taxon_id ?? phylum,
        taxon_rank: "Class",
        scientific_name: "Insecta",
        slug: "insecta",
      })
      .returning("taxon_id");
    const [order] = await knex("taxa")
      .insert({
        parent_id: cls.taxon_id ?? cls,
        taxon_rank: "Order",
        scientific_name: "Lepidoptera",
        slug: "lepidoptera",
      })
      .returning("taxon_id");
    const [family] = await knex("taxa")
      .insert({
        parent_id: order.taxon_id ?? order,
        taxon_rank: "Family",
        scientific_name: "Papilionidae",
        slug: "papilionidae",
      })
      .returning("taxon_id");
    const [genus] = await knex("taxa")
      .insert({
        parent_id: family.taxon_id ?? family,
        taxon_rank: "Genus",
        scientific_name: "Papilio",
        slug: "papilio",
      })
      .returning("taxon_id");
    const [species] = await knex("taxa")
      .insert({
        parent_id: genus.taxon_id ?? genus,
        taxon_rank: "Species",
        scientific_name: "Papilio demoleus",
        slug: "papilio-demoleus",
        vernacular_name_vn: "Bướm phượng chanh",
      })
      .returning("taxon_id");

    const speciesId = Number(species.taxon_id ?? species);
    const prov = await knex("provinces").select("province_id").first();

    const [reg] = await knex("specimen_registry")
      .insert({
        specimen_code: "VN-TEST-0001",
        basis_of_record: "PRESERVED_SPECIMEN",
        recorded_by: "VAST Seed",
      })
      .returning("specimen_id");
    const specId = Number(reg.specimen_id ?? reg);

    await knex("specimens").insert({
      specimen_id: specId,
      taxon_id: speciesId,
      province_id: prov.province_id,
      gbif_scientific_name: "Papilio demoleus",
      collection_date: "2024-03-15",
      collection_point: knex.raw("ST_SetSRID(ST_MakePoint(105.85, 21.02), 4326)::geography"),
      is_public: true,
    });

    await knex.raw("REFRESH MATERIALIZED VIEW mv_taxon_dwc_flat");
  } finally {
    await knex.destroy();
  }
};
