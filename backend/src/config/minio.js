const crypto = require("crypto");
const http = require("http");
const https = require("https");

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = Number(process.env.MINIO_PORT) || 9000;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;
const MINIO_BUCKET = process.env.MINIO_BUCKET || "vietinsect-media";
const MINIO_REGION = "us-east-1";

function assertCredentials() {
  if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
    throw new Error(
      "CRITICAL: MINIO_ACCESS_KEY và MINIO_SECRET_KEY chưa được cấu hình trong môi trường.",
    );
  }
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(encoding);
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function encodeS3Path(rawPath) {
  return rawPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/**
 * Gửi request S3 chuẩn AWS Signature Version 4 trực tiếp tới cụm MinIO nội bộ (không cần cài thêm AWS SDK nặng).
 */
function minioRequest({ method, bucket, key = "", query = "", body = Buffer.alloc(0), contentType = "" }) {
  assertCredentials();
  return new Promise((resolve, reject) => {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
    const payloadHash = sha256Hex(payload);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const hostHeader =
      (MINIO_USE_SSL && MINIO_PORT === 443) || (!MINIO_USE_SSL && MINIO_PORT === 80)
        ? MINIO_ENDPOINT
        : `${MINIO_ENDPOINT}:${MINIO_PORT}`;

    const canonicalUri = key ? `/${bucket}/${encodeS3Path(key)}` : `/${bucket}`;
    const canonicalQueryString = query;

    const headers = {
      host: hostHeader,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) {
      headers["content-type"] = contentType;
    }
    if (payload.length > 0 || method === "PUT" || method === "POST") {
      headers["content-length"] = String(payload.length);
    }

    const sortedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
    const signedHeaders = sortedHeaderKeys.join(";");

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${MINIO_REGION}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = getSigningKey(MINIO_SECRET_KEY, dateStamp, MINIO_REGION, "s3");
    const signature = hmac(signingKey, stringToSign, "hex");

    headers.Authorization = `AWS4-HMAC-SHA256 Credential=${MINIO_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const transport = MINIO_USE_SSL ? https : http;
    const reqPath = canonicalQueryString ? `${canonicalUri}?${canonicalQueryString}` : canonicalUri;

    const req = transport.request(
      {
        hostname: MINIO_ENDPOINT,
        port: MINIO_PORT,
        method,
        path: reqPath,
        headers,
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("MinIO request timeout"));
    });

    if (payload.length > 0) {
      req.write(payload);
    }
    req.end();
  });
}

let _bucketInitialized = false;

async function ensureMediaBucket(bucket = MINIO_BUCKET) {
  if (_bucketInitialized) return;

  const head = await minioRequest({ method: "HEAD", bucket });
  if (head.statusCode === 404) {
    const createRes = await minioRequest({ method: "PUT", bucket });
    if (createRes.statusCode !== 200 && createRes.statusCode !== 409) {
      throw new Error(`Không thể tạo bucket MinIO ${bucket} (HTTP ${createRes.statusCode})`);
    }
  }

  // SRS §2.3 & F-AD-01: Thu hồi hoàn toàn bucket policy public-read nếu tồn tại từ trước.
  // Mọi truy cập ảnh phải đi qua backend proxy (/api/media/:id/file) có kiểm tra is_public.
  await minioRequest({ method: "DELETE", bucket, query: "policy=" }).catch(() => {});

  _bucketInitialized = true;
}

async function putObjectToMinio(objectKey, buffer, contentType = "image/jpeg", bucket = MINIO_BUCKET) {
  await ensureMediaBucket(bucket);
  const res = await minioRequest({
    method: "PUT",
    bucket,
    key: objectKey,
    body: buffer,
    contentType,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`MinIO PUT lỗi HTTP ${res.statusCode}: ${res.body.toString("utf8").slice(0, 160)}`);
  }
  return objectKey;
}

async function deleteObjectFromMinio(objectKey, bucket = MINIO_BUCKET) {
  if (!objectKey) return;
  await minioRequest({ method: "DELETE", bucket, key: objectKey });
}

async function getObjectFromMinio(objectKey, bucket = MINIO_BUCKET) {
  await ensureMediaBucket(bucket);
  const res = await minioRequest({
    method: "GET",
    bucket,
    key: objectKey,
  });
  return { statusCode: res.statusCode, headers: res.headers, body: res.body };
}

module.exports = {
  MINIO_BUCKET,
  ensureMediaBucket,
  putObjectToMinio,
  deleteObjectFromMinio,
  getObjectFromMinio,
};
