require("dotenv").config();

if (!process.env.DB_PASSWORD) {
  throw new Error("CRITICAL: DB_PASSWORD chưa được cấu hình trong môi trường.");
}

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "vietinsect_db",
    user: process.env.DB_USER || "vietinsect_user",
    password: process.env.DB_PASSWORD,
  },
  pool: { min: 2, max: 10 },
});

module.exports = knex;
