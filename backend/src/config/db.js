const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "vietinsect_db",
  user: process.env.DB_USER || "vietinsect_user",
  password: process.env.DB_PASSWORD || "vietinsect_pass_2026",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Lỗi kết nối PostgreSQL pool:", err);
});

pool.on("connect", () => {
  console.log("Đã kết nối PostgreSQL");
});

module.exports = pool;
