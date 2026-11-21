"use strict";

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./jwt");
const logger = require("./logger");

let ioInstance = null;

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN || "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function initSocket(httpServer) {
  const allowedOrigins = getAllowedOrigins();
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS_NOT_ALLOWED"), false);
      },
      credentials: true,
    },
  });

  // Xác thực JWT khi kết nối — CHỈ cho phép Admin kết nối kênh import
  ioInstance.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const headerAuth = socket.handshake.headers?.authorization;
      const rawToken =
        authToken ||
        (typeof headerAuth === "string" && headerAuth.startsWith("Bearer ")
          ? headerAuth.slice(7).trim()
          : null);

      if (!rawToken) {
        return next(new Error("UNAUTHORIZED: Thiếu JWT token"));
      }

      const decoded = jwt.verify(rawToken, JWT_SECRET);
      if (!decoded || decoded.role !== "admin" || !decoded.adminId) {
        return next(new Error("FORBIDDEN: Chỉ Admin được phép kết nối WebSocket import"));
      }

      socket.admin = {
        adminId: Number(decoded.adminId),
        username: decoded.username,
        role: decoded.role,
      };
      return next();
    } catch (err) {
      return next(new Error("UNAUTHORIZED: Token không hợp lệ hoặc đã hết hạn"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const room = `admin:${socket.admin.adminId}`;
    socket.join(room);
    logger.info(`[SOCKET] Admin ${socket.admin.adminId} joined room ${room}`);
  });

  return ioInstance;
}

function getIo() {
  return ioInstance;
}

/**
 * Phát tiến độ import tới room riêng của Admin — tuyệt đối KHÔNG gửi dữ liệu mẫu Private.
 */
function emitImportProgress(adminId, payload) {
  if (!ioInstance || !adminId) return;
  const safePayload = {
    jobId: payload.jobId,
    status: payload.status,
    processed: Number(payload.processed || 0),
    total: Number(payload.total || 0),
    inserted: Number(payload.inserted || 0),
    failed: Number(payload.failed || 0),
    percent: Number(payload.percent || 0),
  };
  ioInstance.to(`admin:${Number(adminId)}`).emit("import:progress", safePayload);
}

module.exports = {
  initSocket,
  getIo,
  emitImportProgress,
  getAllowedOrigins,
};
