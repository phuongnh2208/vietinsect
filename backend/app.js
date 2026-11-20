const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/config/logger");
const { globalRateLimiter } = require("./src/middleware/rateLimiter");

const app = express();

// Cấu hình số hop reverse proxy tin cậy (Nginx = 1 hop) để express-rate-limit lấy đúng req.ip không bị spoof X-Forwarded-For
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

// Security & parsing middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true, // Cần thiết để gửi/nhận cookie cross-origin
    allowedHeaders: ["Content-Type", "Authorization", "X-View-As"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse HttpOnly cookie cho refresh token (SRS §3.4)

// Request logging (production dùng chuẩn combined không mã màu ANSI)
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "VietInsect API đang hoạt động" });
});

// Rate limiting (SRS §5.2)
app.use("/api/", globalRateLimiter);

// Routes
app.use("/api/auth", require("./src/modules/auth/auth.routes"));
app.use("/api/taxonomy", require("./src/modules/taxonomy/taxonomy.routes"));
app.use("/api/specimens", require("./src/modules/specimen/specimen.routes"));
app.use("/api/dna", require("./src/modules/dna/dna.routes"));
app.use("/api/media", require("./src/modules/media/media.routes"));
app.use("/api/system", require("./src/modules/system/system.routes"));

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
