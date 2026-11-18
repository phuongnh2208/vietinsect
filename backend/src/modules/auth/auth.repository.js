const pool = require("../../config/db");

async function findByUsername(username) {
  const { rows } = await pool.query(
    "SELECT * FROM admin_users WHERE username = $1",
    [username],
  );
  return rows[0] || null;
}

async function incrementFailedAttempts(adminId, attempts, lockedUntil) {
  await pool.query(
    `UPDATE admin_users
     SET failed_login_attempts = $1, locked_until = $2
     WHERE admin_id = $3`,
    [attempts, lockedUntil, adminId],
  );
}

async function resetFailedAttempts(adminId) {
  await pool.query(
    `UPDATE admin_users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
     WHERE admin_id = $1`,
    [adminId],
  );
}

// SRS §3.4 + §5.2: lưu SHA-256 hash của refresh token, không lưu raw.
async function saveRefreshToken(adminId, tokenHash, expiresAt) {
  await pool.query(
    `INSERT INTO admin_refresh_tokens (admin_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [adminId, tokenHash, expiresAt],
  );
}

async function findRefreshToken(tokenHash) {
  const { rows } = await pool.query(
    `SELECT * FROM admin_refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
    [tokenHash],
  );
  return rows[0] || null;
}

async function revokeRefreshToken(tokenHash) {
  await pool.query(
    "UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1",
    [tokenHash],
  );
}

// logout-all: thu hồi mọi phiên đang hoạt động của một admin.
async function revokeAllRefreshTokens(adminId) {
  await pool.query(
    `UPDATE admin_refresh_tokens SET revoked_at = NOW()
     WHERE admin_id = $1 AND revoked_at IS NULL`,
    [adminId],
  );
}

module.exports = {
  findByUsername,
  incrementFailedAttempts,
  resetFailedAttempts,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
