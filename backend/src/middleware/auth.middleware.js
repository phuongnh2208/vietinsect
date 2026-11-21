const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");
const AppError = require("../utils/appError");
const { isTokenBlacklisted, isUserTokenRevoked } = require("../modules/auth/tokenBlacklist");

const TOKEN_MISSING = {
  code: "AUTH.TOKEN_MISSING",
  message: "Thiếu token xác thực",
  statusCode: 401,
};

const TOKEN_INVALID = {
  code: "AUTH.TOKEN_INVALID",
  message: "Token không hợp lệ hoặc đã hết hạn",
  statusCode: 401,
};

async function verifyAndCheckBlacklist(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.jti && (await isTokenBlacklisted(decoded.jti))) {
    throw new AppError(TOKEN_INVALID);
  }
  const issuedMs = decoded.iatMs || (decoded.iat ? decoded.iat * 1000 : null);
  if (decoded.adminId && issuedMs && (await isUserTokenRevoked(decoded.adminId, issuedMs))) {
    throw new AppError(TOKEN_INVALID);
  }
  return decoded;
}

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next(new AppError(TOKEN_MISSING));
  }

  try {
    const decoded = await verifyAndCheckBlacklist(token);
    if (!decoded || decoded.role !== "admin" || !decoded.adminId) {
      return next(
        new AppError({
          code: "AUTH.FORBIDDEN",
          message: "Chỉ Admin mới có quyền thực hiện thao tác này",
          statusCode: 403,
        }),
      );
    }
    req.admin = decoded;
    next();
  } catch (err) {
    if (err?.statusCode === 503) return next(err);
    next(new AppError(TOKEN_INVALID));
  }
}

/**
 * Middleware cho các endpoint dual-context (công khai + admin):
 * - Nếu không gửi Authorization header → req.admin = null, cho phép đọc dữ liệu public.
 * - Nếu có gửi Bearer token → verify để cấp quyền admin; nếu hết hạn trả 401 để client tự refresh.
 */
async function optionalAdmin(req, res, next) {
  const viewAs = String(req.headers["x-view-as"] || "").trim().toLowerCase();
  if (viewAs === "public") {
    req.admin = null;
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    req.admin = null;
    return next();
  }

  try {
    const decoded = await verifyAndCheckBlacklist(token);
    req.admin = decoded && decoded.role === "admin" && decoded.adminId ? decoded : null;
    next();
  } catch (err) {
    if (err?.statusCode === 503) return next(err);
    next(new AppError(TOKEN_INVALID));
  }
}

module.exports = { requireAdmin, optionalAdmin };
