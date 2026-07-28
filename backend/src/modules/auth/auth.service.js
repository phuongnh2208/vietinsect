const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRepository = require("./auth.repository");
const AuthError = require("./auth.errors");
const AppError = require("../../utils/appError");
const logger = require("../../config/logger");

const JWT_SECRET = process.env.JWT_SECRET || "doi_chuoi_bi_mat_nay_sau";
const JWT_EXPIRES_IN = "24h";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

async function login(username, password) {
  const user = await authRepository.findByUsername(username);

  if (!user) {
    throw new AppError(AuthError.INVALID_CREDENTIALS);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError(AuthError.ACCOUNT_LOCKED);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;

    await authRepository.incrementFailedAttempts(
      user.admin_id,
      attempts,
      shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000) : null,
    );

    throw new AppError(AuthError.INVALID_CREDENTIALS);
  }

  await authRepository.resetFailedAttempts(user.admin_id);

  const token = jwt.sign(
    { adminId: user.admin_id, username: user.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  logger.info(`Admin đăng nhập thành công: ${username}`);

  return {
    token,
    user: {
      adminId: user.admin_id,
      username: user.username,
      fullName: user.full_name,
    },
  };
}

module.exports = { login };
