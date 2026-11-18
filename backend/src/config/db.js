const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DB_PASSWORD) {
  throw new Error("CRITICAL: DB_PASSWORD chưa được cấu hình trong môi trường.");
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "vietinsect_db",
  user: process.env.DB_USER || "vietinsect_user",
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Lỗi kết nối PostgreSQL pool:", err);
});

module.exports = pool;
