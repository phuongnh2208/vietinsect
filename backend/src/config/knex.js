require("dotenv").config();

if (!process.env.DB_PASSWORD) {
  throw new Error("CRITICAL: DB_PASSWORD chưa được cấu hình trong môi trường.");
}

const dbName =
  process.env.NODE_ENV === "test"
    ? process.env.DB_TEST_NAME || "vietinsect_test"
    : process.env.DB_NAME || "vietinsect_db";

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: dbName,
    user: process.env.DB_USER || "vietinsect_user",
    password: process.env.DB_PASSWORD,
  },
  pool: { min: 2, max: 10 },
});

module.exports = knex;
