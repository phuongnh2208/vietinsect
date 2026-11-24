const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/config/logger");
const { globalRateLimiter } = require("./src/middleware/rateLimiter");
const { checkEsHealth } = require("./src/config/elasticsearch");

const app = express();

// Cấu hình số hop reverse proxy tin cậy (Nginx = 1 hop) để express-rate-limit lấy đúng req.ip không bị spoof X-Forwarded-For
const trustProxyHops = Number(process.env.TRUST_PROXY ?? process.env.TRUST_PROXY_HOPS ?? 1);
if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

// Security & parsing middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true, // Cần thiết để gửi/nhận cookie cross-origin
    allowedHeaders: ["Content-Type", "Authorization", "X-View-As"],
  }),
);
const defaultJsonParser = express.json();
app.use((req, res, next) => {
  if (req.path.startsWith("/api/specimens/bulk-import")) return next();
  return defaultJsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse HttpOnly cookie cho refresh token (SRS §3.4)

// Request logging (production dùng chuẩn combined không mã màu ANSI)
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// Health check (kèm trạng thái Elasticsearch & Outbox — DEF-059, DEF-112)
const { getOutboxStats } = require("./src/modules/search/esOutbox.service");
const { optionalAdmin } = require("./src/middleware/auth.middleware");

app.get("/api/health", optionalAdmin, async (req, res) => {
  const [elasticsearch, outboxStats] = await Promise.all([
    checkEsHealth(),
    getOutboxStats(),
  ]);
  const outboxStatus =
    outboxStats.error || outboxStats.dead > 0 || outboxStats.oldestPendingAgeSeconds > 60
      ? "degraded"
      : "ok";
  const esOutbox = req.admin
    ? { status: outboxStatus, ...outboxStats }
    : { status: outboxStatus };
  res.json({
    success: true,
    message: "VietInsect API đang hoạt động",
    services: { elasticsearch, esOutbox },
  });
});

// Rate limiting (SRS §5.2)
app.use("/api/", globalRateLimiter);

// Routes
app.use("/api/auth", require("./src/modules/auth/auth.routes"));
app.use("/api/taxonomy", require("./src/modules/taxonomy/taxonomy.routes"));
app.use("/api/specimens", require("./src/modules/specimen/specimen.routes"));
app.use("/api/search", require("./src/modules/search/search.routes"));
app.use("/api/dna", require("./src/modules/dna/dna.routes"));
app.use("/api/media", require("./src/modules/media/media.routes"));
app.use("/api/reports", require("./src/modules/reports/reports.routes"));
app.use("/api/system", require("./src/modules/system/system.routes"));

// Phục vụ Frontend production build (single-origin cho Cloudflare Tunnel / deploy demo)
const frontendBuildDir = path.resolve(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildDir)) {
  app.use(express.static(frontendBuildDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      return res.sendFile(path.join(frontendBuildDir, "index.html"));
    }
    return next();
  });
}

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
