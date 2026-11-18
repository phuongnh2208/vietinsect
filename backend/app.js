const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/config/logger");

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true, // Cần thiết để gửi/nhận cookie cross-origin
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse HttpOnly cookie cho refresh token (SRS §3.4)

// Request logging
app.use(
  morgan("dev", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "VietInsect API đang hoạt động" });
});

// Routes
app.use("/api/auth", require("./src/modules/auth/auth.routes"));
app.use("/api/taxonomy", require("./src/modules/taxonomy/taxonomy.routes"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "Endpoint không tồn tại",
  });
});

app.use(errorHandler);

module.exports = app;
