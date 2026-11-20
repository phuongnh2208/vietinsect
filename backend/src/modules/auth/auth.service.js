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
  const now = Date.now();

  // DEF-011: Kiểm tra trạng thái khóa trước khi so mật khẩu; nếu đang khóa luôn báo ACCOUNT_LOCKED
  if (user && user.locked_until && new Date(user.locked_until).getTime() > now) {
    throw new AppError(AuthError.ACCOUNT_LOCKED);
  }

  // S3: Luôn chạy bcrypt.compare dù user có tồn tại hay không, tránh timing attack.
  const hash = user ? user.password_hash : DUMMY_HASH;
  const isMatch = await bcrypt.compare(password, hash);

  if (!user || !isMatch) {
    if (user) {
      // Nếu khóa cũ đã hết hạn (locked_until <= now), reset bộ đếm về 0 trước khi cộng
      const lockExpired = Boolean(user.locked_until && new Date(user.locked_until).getTime() <= now);
      const baseAttempts = lockExpired ? 0 : user.failed_login_attempts || 0;
      const attempts = baseAttempts + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      await authRepository.incrementFailedAttempts(
        user.admin_id,
        attempts,
        shouldLock ? new Date(now + LOCK_DURATION_MINUTES * 60000) : null,
      );
    }
    throw new AppError(AuthError.INVALID_CREDENTIALS);
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

  // SRS §6.5: truy vấn qua Knex repository thay vì raw pg pool
  const user = await authRepository.findById(record.admin_id);
  if (!user) throw new AppError(AuthError.INVALID_CREDENTIALS);

  const accessToken = jwt.sign(
    { adminId: user.admin_id, username: user.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN },
  );

  return {
    accessToken,
    user: {
      adminId: user.admin_id,
      username: user.username,
      fullName: user.full_name,
    },
  };
}

async function logout(refreshTokenRaw) {
  if (!refreshTokenRaw) return;
  const tokenHash = crypto.createHash("sha256").update(refreshTokenRaw).digest("hex");
  await authRepository.revokeRefreshToken(tokenHash);
}

async function logoutAll(adminId) {
  await authRepository.revokeAllRefreshTokens(adminId);
}

async function changePassword(adminId, currentPassword, newPassword) {
  const user = await authRepository.findByIdWithHash(adminId);
  if (!user) throw new AppError(AuthError.INVALID_CREDENTIALS);

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw new AppError(AuthError.WRONG_CURRENT_PASSWORD);

  // SRS §5.2: băm bcrypt cost factor 12
  const newHash = await bcrypt.hash(newPassword, 12);
  await authRepository.updatePasswordHash(adminId, newHash);
  await authRepository.revokeAllRefreshTokens(adminId);
  logger.info(`Admin #${adminId} (${user.username}) đã cập nhật mật khẩu.`);
}

module.exports = { login, refresh, logout, logoutAll, changePassword };
