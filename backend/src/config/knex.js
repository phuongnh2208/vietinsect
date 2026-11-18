/**
 * Knex instance dùng cho taxonomy repository (SRS §6.5).
 * auth.repository.js và các module khác tiếp tục dùng pg Pool (db.js).
 * Dùng cùng connection settings với db.js để tránh mở pool thứ hai.
 */
require("dotenv").config();

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "vietinsect_db",
    user: process.env.DB_USER || "vietinsect_user",
    password: process.env.DB_PASSWORD || "vietinsect_pass_2026",
  },
  pool: { min: 2, max: 10 },
});

module.exports = knex;
