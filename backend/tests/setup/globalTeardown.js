"use strict";

require("dotenv").config();
const { Client } = require("pg");

const TEST_DB = process.env.DB_TEST_NAME || "vietinsect_test";

module.exports = async function globalTeardown() {
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
  } finally {
    await adminClient.end();
  }
};
