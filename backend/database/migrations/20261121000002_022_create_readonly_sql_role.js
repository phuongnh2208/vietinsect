"use strict";

const ALLOWED_TABLES = [
  "specimens",
  "specimen_registry",
  "taxa",
  "provinces",
  "dna_sequences",
  "specimen_images",
  "bioactivity_records",
  "ai_identifications",
  "sdm_predictions",
  "iucn_assessments",
  "taxon_synonyms",
  "lookup_values",
  "mv_taxon_dwc_flat",
];

const FORBIDDEN_TABLES = [
  "admin_users",
  "audit_logs",
  "system_config",
  "saved_filters",
  "es_sync_outbox",
  "knex_migrations",
  "knex_migrations_lock",
];

exports.up = async function up(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vietinsect_readonly') THEN
        CREATE ROLE vietinsect_readonly NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOREPLICATION;
      END IF;
    END
    $$;
  `);

  await knex.raw(`GRANT vietinsect_readonly TO CURRENT_USER`);
  await knex.raw(`ALTER ROLE vietinsect_readonly SET search_path = public, pg_temp`);
  await knex.raw(`GRANT USAGE ON SCHEMA public TO vietinsect_readonly`);
  await knex.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vietinsect_readonly`);
  await knex.raw(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM vietinsect_readonly`);
  await knex.raw(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM vietinsect_readonly`);

  for (const tbl of ALLOWED_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = '${tbl}'
        ) THEN
          EXECUTE 'GRANT SELECT ON public.${tbl} TO vietinsect_readonly';
        END IF;
      END
      $$;
    `);
  }

  for (const tbl of FORBIDDEN_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = '${tbl}'
        ) THEN
          EXECUTE 'REVOKE ALL ON public.${tbl} FROM vietinsect_readonly';
        END IF;
      END
      $$;
    `);
  }
};

exports.down = async function down(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vietinsect_readonly') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vietinsect_readonly;
        REVOKE USAGE ON SCHEMA public FROM vietinsect_readonly;
      END IF;
    END
    $$;
  `);
};
