"use strict";

require("dotenv").config();
const { encryptSecret, decryptSecret, maskSecret } = require("../../src/utils/cryptoConfig");
const { buildMediaProxyUrl, verifyMediaAccess } = require("../../src/modules/media/mediaUrl.util");

describe("Unit Tests: Security & Cryptographic Primitives (SRS §5.2)", () => {
  describe("AES-256-GCM Externalized Keyring (cryptoConfig)", () => {
    test("encryptSecret & decryptSecret round-trip preserves exact plaintext", () => {
      const secretPlain = "ncbi_entrez_secret_api_key_2026_vast";
      const encrypted = encryptSecret(secretPlain);

      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.alg).toBe("AES-256-GCM");
      expect(encrypted.keyVersion).toBeDefined();
      expect(encrypted.iv).toMatch(/^[0-9a-f]{24}$/); // 96-bit IV (12 bytes = 24 hex chars)
      expect(encrypted.tag).toMatch(/^[0-9a-f]{32}$/); // 128-bit Auth Tag

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(secretPlain);
    });

    test("encryptSecret generates unique random IV on every invocation", () => {
      const e1 = encryptSecret("same-secret-value");
      const e2 = encryptSecret("same-secret-value");
      expect(e1.iv).not.toBe(e2.iv);
      expect(e1.ciphertext).not.toBe(e2.ciphertext);
    });

    test("decryptSecret throws error when GCM auth tag or ciphertext is tampered", () => {
      const encrypted = encryptSecret("sensitive_token_12345");
      const tamperedTag = {
        ...encrypted,
        tag: encrypted.tag.replace(/^[0-9a-f]{2}/, encrypted.tag.startsWith("00") ? "ff" : "00"),
      };
      expect(() => decryptSecret(tamperedTag)).toThrow();
    });

    test("maskSecret masks prefix and exposes only last 4 characters", () => {
      expect(maskSecret("abcdef1234567890")).toBe("••••••••••••7890");
      expect(maskSecret("short")).toBe("••••••••");
      expect(maskSecret("")).toBe("");
    });
  });

  describe("MinIO Media HMAC-SHA256 Signed Proxy URLs (mediaUrl.util)", () => {
    test("Public media generates unsigned proxy path", () => {
      const url = buildMediaProxyUrl(46, { isAdmin: false, isEffectivelyPublic: true });
      expect(url).toMatch(/\/api\/media\/46\/file$/);
      expect(url).not.toContain("sig=");
    });

    test("Private media for Admin generates time-bound HMAC signed URL", () => {
      const url = buildMediaProxyUrl(46, { isAdmin: true, isEffectivelyPublic: false });
      const parsed = new URL(url);
      const exp = parsed.searchParams.get("exp");
      const sig = parsed.searchParams.get("sig");

      expect(exp).toBeTruthy();
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyMediaAccess(46, exp, sig)).toBe(true);
    });

    test("HMAC signature is strictly bound to imageId and rejects ID swapping", () => {
      const url = buildMediaProxyUrl(46, { isAdmin: true, isEffectivelyPublic: false });
      const parsed = new URL(url);
      const exp = parsed.searchParams.get("exp");
      const sig = parsed.searchParams.get("sig");

      // Dùng chữ ký của ảnh 46 cho ảnh 47 phải bị từ chối
      expect(verifyMediaAccess(47, exp, sig)).toBe(false);
    });

    test("Expired or malformed signature is rejected", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      expect(verifyMediaAccess(46, pastExp, "a".repeat(64))).toBe(false);
      expect(verifyMediaAccess(46, null, null)).toBe(false);
    });
  });
});
