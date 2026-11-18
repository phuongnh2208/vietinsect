#!/usr/bin/env node
/**
 * rotate-encryption-key.js
 *
 * Re-encrypts all secret config values in `system_config` after a master-key change.
 *
 * Usage:
 *   node scripts/rotate-encryption-key.js --old-secret <old-hex-key>
 *
 * The NEW key is read from CONFIG_ENCRYPTION_SECRET in the environment (.env).
 * If --old-secret is omitted and no encrypted values exist, the script exits cleanly.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const crypto = require("crypto");
const { Pool } = require("pg");

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let oldSecret = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--old-secret" && args[i + 1]) {
    oldSecret = args[i + 1];
    break;
  }
}

const newSecret = process.env.CONFIG_ENCRYPTION_SECRET;
if (!newSecret) {
  console.error("ERROR: CONFIG_ENCRYPTION_SECRET is not set in environment / .env");
  process.exit(1);
}

// ── Crypto helpers (mirror cryptoConfig.js logic) ───────────────────────────
function deriveKey(secret, salt) {
  return crypto.scryptSync(secret, salt, 32);
}

function decryptWithKey(payload, key) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function encryptWithKey(plainText, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: true,
    alg: "AES-256-GCM",
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Find rows where config_value->>'isSecret' = 'true' and the secret object
    // has encrypted = true.
    const { rows } = await pool.query(`
      SELECT id, config_key, config_value
      FROM system_config
      WHERE config_value->>'isSecret' = 'true'
        AND (config_value->'secret'->>'encrypted')::boolean = true
    `);

    if (rows.length === 0) {
      console.log("No encrypted secret values found in system_config — nothing to migrate.");

      // Also check: are there isSecret rows at all, but with null/empty secrets?
      const { rows: secretRows } = await pool.query(`
        SELECT config_key, config_value->'secret' AS secret
        FROM system_config
        WHERE config_value->>'isSecret' = 'true'
      `);
      if (secretRows.length > 0) {
        console.log(
          `Found ${secretRows.length} isSecret row(s) but none have encrypted data:`,
          secretRows.map((r) => r.config_key).join(", ")
        );
      }
      return;
    }

    if (!oldSecret) {
      console.error(
        `ERROR: Found ${rows.length} encrypted value(s) but --old-secret was not provided.\n` +
        "Usage: node scripts/rotate-encryption-key.js --old-secret <old-hex-key>"
      );
      process.exit(1);
    }

    // Old key used salt v1; new key uses salt v2 (matches updated cryptoConfig.js).
    const oldKey = deriveKey(oldSecret, "vietinsect-aes256gcm-salt-v1");
    const newKey = deriveKey(newSecret, "vietinsect-aes256gcm-salt-v2");

    let migrated = 0;
    let failed = 0;

    for (const row of rows) {
      const secretPayload = row.config_value.secret;
      try {
        // Decrypt with old key
        const plainText = decryptWithKey(secretPayload, oldKey);
        // Re-encrypt with new key
        const newPayload = encryptWithKey(plainText, newKey);

        // Update the row: replace secret object inside config_value
        const updatedValue = { ...row.config_value, secret: newPayload };
        await pool.query(
          `UPDATE system_config SET config_value = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedValue), row.id]
        );

        console.log(`  ✔ Rotated: ${row.config_key} (id=${row.id})`);
        migrated++;
      } catch (err) {
        console.error(`  ✘ FAILED: ${row.config_key} (id=${row.id}) — ${err.message}`);
        failed++;
      }
    }

    console.log(`\nRotation complete: ${migrated} migrated, ${failed} failed out of ${rows.length} total.`);
    if (failed > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
