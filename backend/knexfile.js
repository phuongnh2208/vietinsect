require("dotenv").config();

module.exports = {
  development: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "vietinsect_db",
      user: process.env.DB_USER || "vietinsect_user",
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: "./database/migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "./database/seeds",
    },
  },
  test: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_TEST_NAME || "vietinsect_test",
      user: process.env.DB_USER || "vietinsect_user",
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: "./database/migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "./database/seeds",
    },
  },
};
