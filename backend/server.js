require("dotenv").config();
const app = require("./app");
const logger = require("./src/config/logger");
const pool = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`VietInsect Backend đang chạy tại http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM nhận được, đóng server...");
  server.close(async () => {
    await pool.end();
    logger.info("Đã đóng kết nối DB, thoát.");
    process.exit(0);
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
});
