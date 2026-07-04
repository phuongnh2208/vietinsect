// packages/backend/knexfile.js
module.exports = {
  development: {
    client: "postgresql",
    connection: {
      host:     "localhost",
      port:     5432,
      database: "vietinsect_db",
      user:     "vietinsect_user",
      password: "vietinsect_pass_2026",
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