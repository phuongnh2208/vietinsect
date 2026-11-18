const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/jwt");
const AppError = require("../utils/appError");

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

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next(new AppError(TOKEN_MISSING));
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    next(new AppError(TOKEN_INVALID));
  }
}

/**
 * Middleware cho các endpoint dual-context (công khai + admin):
 * - Nếu không gửi Authorization header → req.admin = null, cho phép đọc dữ liệu public.
 * - Nếu có gửi Bearer token → verify để cấp quyền admin; nếu hết hạn trả 401 để client tự refresh.
 */
function optionalAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    req.admin = null;
    return next();
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    next(new AppError(TOKEN_INVALID));
  }
}

module.exports = { requireAdmin, optionalAdmin };
