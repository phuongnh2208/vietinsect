"use strict";

const { Readable } = require("stream");
const {
  classifyImageLicense,
  toWhitelistedLargeUrl,
  detectImageMagicBytes,
  safeDownloadImage,
} = require("../../scripts/lib/mediaSecurity");

describe("Step 3 - Media Security & License Policy", () => {
  test("classifyImageLicense allows only CC0, CC BY, CC BY-SA for MinIO download", () => {
    expect(classifyImageLicense("http://creativecommons.org/publicdomain/zero/1.0/").canDownloadToMinio).toBe(true);
    expect(classifyImageLicense("http://creativecommons.org/licenses/by/4.0/").canDownloadToMinio).toBe(true);
    expect(classifyImageLicense("http://creativecommons.org/licenses/by-sa/4.0/").canDownloadToMinio).toBe(true);
    expect(classifyImageLicense("http://creativecommons.org/licenses/by-nc/4.0/").canDownloadToMinio).toBe(false);
    expect(classifyImageLicense("http://creativecommons.org/licenses/by-nd/4.0/").canDownloadToMinio).toBe(false);
    expect(classifyImageLicense(null).canDownloadToMinio).toBe(false);
  });

  test("toWhitelistedLargeUrl converts iNaturalist URLs to large and rejects non-whitelisted hosts", () => {
    expect(
      toWhitelistedLargeUrl("https://inaturalist-open-data.s3.amazonaws.com/photos/758514131/original.jpg")
    ).toBe("https://inaturalist-open-data.s3.amazonaws.com/photos/758514131/large.jpg");
    expect(toWhitelistedLargeUrl("https://evil.example.com/photos/123/original.jpg")).toBeNull();
    expect(toWhitelistedLargeUrl("http://127.0.0.1/photos/123/original.jpg")).toBeNull();
  });

  test("rejects redirect to 127.0.0.1 and DNS resolving to private IP", async () => {
    const fakeRedirectHttp = {
      get: async () => ({ status: 302, headers: { location: "http://127.0.0.1/secret.jpg" }, data: Readable.from([]) }),
    };
    await expect(
      safeDownloadImage("https://static.inaturalist.org/photos/1/large.jpg", {
        httpClient: fakeRedirectHttp,
        dnsLookup: async () => [{ address: "52.92.1.1" }],
      })
    ).rejects.toThrow(/BLOCKED_/);

    await expect(
      safeDownloadImage("https://static.inaturalist.org/photos/1/large.jpg", {
        dnsLookup: async () => [{ address: "127.0.0.1" }],
      })
    ).rejects.toThrow("BLOCKED_DNS_PRIVATE_IP");
  });

  test("rejects fake magic bytes and oversized stream (> maxBytes)", async () => {
    const fakeHtmlHttp = {
      get: async () => ({ status: 200, headers: {}, data: Readable.from([Buffer.from("<html>not an image</html>")]) }),
    };
    await expect(
      safeDownloadImage("https://static.inaturalist.org/photos/1/large.jpg", {
        httpClient: fakeHtmlHttp,
        dnsLookup: async () => [{ address: "52.92.1.1" }],
      })
    ).rejects.toThrow("BLOCKED_INVALID_MAGIC_BYTES");

    const bigStreamHttp = {
      get: async () => ({ status: 200, headers: {}, data: Readable.from([Buffer.alloc(2048, 0xff)]) }),
    };
    await expect(
      safeDownloadImage("https://static.inaturalist.org/photos/1/large.jpg", {
        maxBytes: 1024,
        httpClient: bigStreamHttp,
        dnsLookup: async () => [{ address: "52.92.1.1" }],
      })
    ).rejects.toThrow("BLOCKED_FILE_TOO_LARGE");

    // Valid JPEG magic bytes pass
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageMagicBytes(validJpeg)).toBe("image/jpeg");
  });
});
