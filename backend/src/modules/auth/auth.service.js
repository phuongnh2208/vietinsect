const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRepository = require("./auth.repository");
const AuthError = require("./auth.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");
const { JWT_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRES_IN } = require("../../config/jwt");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

// S3: dummy hash để tránh timing attack khi username không tồn tại.
// bcrypt.compare luôn chạy kể cả khi user = null → response time như nhau.
const DUMMY_HASH = "$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnn";

async function login(username, password) {
  const user = await authRepository.findByUsername(username);

  // S3: Luôn chạy bcrypt.compare dù user có tồn tại hay không, tránh timing attack.
  const hash = user ? user.password_hash : DUMMY_HASH;
  const isMatch = await bcrypt.compare(password, hash);

  if (!user || !isMatch) {
    if (user) {
      // Chỉ increment failed attempts khi user tồn tại thật
      const attempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      await authRepository.incrementFailedAttempts(
        user.admin_id,
        attempts,
        shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000) : null,
      );
    }
    throw new AppError(AuthError.INVALID_CREDENTIALS);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(AuthError.ACCOUNT_LOCKED);
  }

  await authRepository.resetFailedAttempts(user.admin_id);

  // accessToken: 15 phút, trả về JSON body → lưu in-memory Zustand.
  const accessToken = jwt.sign(
    { adminId: user.admin_id, username: user.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN },
  );

  // refreshToken: 7 ngày, raw chỉ trả cho controller để set vào HttpOnly cookie.
  // DB lưu SHA-256 hash, không lưu raw.
  const refreshTokenRaw = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await authRepository.saveRefreshToken(user.admin_id, tokenHash, expiresAt);

  logger.info(`Admin đăng nhập thành công: ${username}`);

  return {
    accessToken,
    refreshTokenRaw, // Controller set vào HttpOnly cookie — không đưa ra client body
    user: {
      adminId: user.admin_id,
      username: user.username,
      fullName: user.full_name,
    },
  };
}

async function refresh(refreshTokenRaw) {
  const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
  const record = await authRepository.findRefreshToken(tokenHash);
  if (!record) throw new AppError(AuthError.INVALID_CREDENTIALS);

  // Lấy thông tin user để embed vào token mới
  const { rows } = await require("../../config/db").query(
    "SELECT admin_id, username FROM admin_users WHERE admin_id = $1",
    [record.admin_id],
  );
  const user = rows[0];
  if (!user) throw new AppError(AuthError.INVALID_CREDENTIALS);

  const accessToken = jwt.sign(
    { adminId: user.admin_id, username: user.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN },
  );
  return { accessToken };
}

async function logout(refreshTokenRaw) {
  if (!refreshTokenRaw) return;
  const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
  await authRepository.revokeRefreshToken(tokenHash);
}

async function logoutAll(adminId) {
  await authRepository.revokeAllRefreshTokens(adminId);
}

module.exports = { login, refresh, logout, logoutAll };
