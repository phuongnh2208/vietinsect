const knex = require("../../config/knex");

async function findByUsername(identifier) {
  const row = await knex("admin_users")
    .where("username", identifier)
    .orWhereRaw("lower(email) = lower(?)", [identifier])
    .first();
  return row || null;
}

async function findById(adminId) {
  const row = await knex("admin_users")
    .select("admin_id", "username", "full_name", "email")
    .where("admin_id", adminId)
    .first();
  return row || null;
}

async function incrementFailedAttempts(adminId, attempts, lockedUntil) {
  await knex("admin_users")
    .where("admin_id", adminId)
    .update({
      failed_login_attempts: attempts,
      locked_until: lockedUntil,
    });
}

async function resetFailedAttempts(adminId) {
  await knex("admin_users")
    .where("admin_id", adminId)
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: knex.fn.now(),
    });
}

// SRS §3.4 + §5.2: lưu SHA-256 hash của refresh token, không lưu raw.
async function saveRefreshToken(adminId, tokenHash, expiresAt) {
  await knex("admin_refresh_tokens").insert({
    admin_id: adminId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
}

async function findRefreshToken(tokenHash) {
  const row = await knex("admin_refresh_tokens")
    .where("token_hash", tokenHash)
    .where("expires_at", ">", knex.fn.now())
    .whereNull("revoked_at")
    .first();
  return row || null;
}

async function revokeRefreshToken(tokenHash) {
  await knex("admin_refresh_tokens")
    .where("token_hash", tokenHash)
    .update({ revoked_at: knex.fn.now() });
}

// logout-all: thu hồi mọi phiên đang hoạt động của một admin.
async function revokeAllRefreshTokens(adminId) {
  await knex("admin_refresh_tokens")
    .where("admin_id", adminId)
    .whereNull("revoked_at")
    .update({ revoked_at: knex.fn.now() });
}

async function findByIdWithHash(adminId) {
  const row = await knex("admin_users").where("admin_id", adminId).first();
  return row || null;
}

async function updatePasswordHash(adminId, passwordHash) {
  await knex("admin_users")
    .where("admin_id", adminId)
    .update({ password_hash: passwordHash });
}

module.exports = {
  findByUsername,
  findById,
  findByIdWithHash,
  updatePasswordHash,
  incrementFailedAttempts,
  resetFailedAttempts,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
