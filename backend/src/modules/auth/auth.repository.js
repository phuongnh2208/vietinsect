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

module.exports = {
  findByUsername,
  incrementFailedAttempts,
  resetFailedAttempts,
};
