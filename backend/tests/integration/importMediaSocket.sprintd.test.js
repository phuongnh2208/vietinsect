"use strict";

jest.setTimeout(30000);

const http = require("http");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { io: ioClient } = require("socket.io-client");
const app = require("../../app");
const knex = require("../../src/config/knex");
const pool = require("../../src/config/db");
const { JWT_SECRET } = require("../../src/config/jwt");
const { initSocket } = require("../../src/config/socket");
const mediaService = require("../../src/modules/media/media.service");
const { closeRateLimiterRedis } = require("../../src/middleware/rateLimiter");

describe("Sprint D Group 2 – Bulk Import (WebSocket JWT), Sharp Thumbnail 200x200 & Magic Bytes", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  let server;
  let port;
  let admin;
  let adminToken;
  let userToken;
  let taxonId;
  const createdSpecimenIds = [];

  beforeAll(async () => {
    admin = await knex("admin_users").select("admin_id", "username").first();
    adminToken = jwt.sign(
      { adminId: Number(admin.admin_id), username: admin.username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    userToken = jwt.sign(
      { userId: 99, username: "public_user", role: "user" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    const taxon = await knex("taxa").where("taxon_rank", "Species").first();
    taxonId = taxon.taxon_id;

    server = http.createServer(app);
    initSocket(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    if (createdSpecimenIds.length > 0) {
      await knex("es_sync_outbox").whereIn("entity_id", createdSpecimenIds).delete();
      await knex("specimen_change_history").whereIn("specimen_id", createdSpecimenIds).delete();
      await knex("specimens").whereIn("specimen_id", createdSpecimenIds).delete();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecimenIds).delete();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeRateLimiterRedis();
    await knex.destroy();
    await pool.end();
  });

  it("1. WebSocket rejects unauthenticated and non-Admin connections", async () => {
    const connectErr = (opts) =>
      new Promise((resolve) => {
        const client = ioClient(`http://127.0.0.1:${port}`, {
          reconnection: false,
          transports: ["websocket"],
          ...opts,
        });
        client.on("connect_error", (err) => {
          client.close();
          resolve(err.message);
        });
        client.on("connect", () => {
          client.close();
          resolve("CONNECTED");
        });
      });

    const noTokenMsg = await connectErr({});
    expect(noTokenMsg).toContain("UNAUTHORIZED");

    const userTokenMsg = await connectErr({ auth: { token: userToken } });
    expect(userTokenMsg).toContain("FORBIDDEN");

    // Token passed in URL query string MUST be rejected (never accept JWT in URL)
    const urlTokenMsg = await connectErr({ query: { token: adminToken } });
    expect(urlTokenMsg).toContain("UNAUTHORIZED");
  });

  it("2. Bulk import preview returns max 20 rows with red (error) / yellow (warning) and rejects > 5000 rows", async () => {
    const rows = [
      { scientificName: "", collectionDate: "bad-date" }, // error (red)
      { taxonId, collectionDate: "2024-05-01" }, // warning (yellow - missing GPS)
      { taxonId, collectionDate: "2024-05-01", latitude: 20.3, longitude: 105.6 }, // ok
    ];
    const res = await request(app)
      .post("/api/specimens/bulk-import/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rows });

    expect(res.status).toBe(200);
    expect(res.body.data.errorCount).toBe(1);
    expect(res.body.data.warningCount).toBe(1);
    expect(res.body.data.previewRows[0].severity).toBe("error");
    expect(res.body.data.previewRows[1].severity).toBe("warning");
    expect(res.body.data.previewRows[2].severity).toBe("ok");

    const tooMany = Array.from({ length: 5001 }, () => ({ taxonId, collectionDate: "2024-05-01" }));
    const limitRes = await request(app)
      .post("/api/specimens/bulk-import/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rows: tooMany });
    expect(limitRes.status).toBe(400);
    expect(limitRes.body.code).toBe("IMPORT.LIMIT_EXCEEDED");
  });

  it("3. Async bulk import emits realtime Socket.io progress to Admin room, isolates row errors, and writes ES outbox", async () => {
    const progressEvents = [];
    const client = ioClient(`http://127.0.0.1:${port}`, {
      reconnection: false,
      transports: ["websocket"],
      auth: { token: adminToken },
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    client.on("import:progress", (payload) => {
      progressEvents.push(payload);
    });

    const rows = [
      {
        specimenCode: `IMP-${suffix}-OK1`,
        taxonId,
        collectionDate: "2024-05-01",
        commonNameVn: `Mẫu import hợp lệ ${suffix}`,
        isPublic: false,
      },
      {
        specimenCode: `IMP-${suffix}-BAD`,
        scientificName: "NonExistentSpeciesXYZ",
        collectionDate: "2024-05-01",
      },
    ];

    const startRes = await request(app)
      .post("/api/specimens/bulk-import/async")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rows });
    expect(startRes.status).toBe(202);
    const { jobId } = startRes.body.data;

    let finalJob = null;
    for (let i = 0; i < 30; i += 1) {
      const poll = await request(app)
        .get(`/api/specimens/bulk-import/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      finalJob = poll.body.data;
      if (finalJob.status === "done" || finalJob.status === "failed") break;
      await new Promise((r) => setTimeout(r, 100));
    }

    client.close();

    expect(finalJob.status).toBe("done");
    expect(finalJob.inserted).toBe(1);
    expect(finalJob.failed).toBe(1);
    expect(finalJob.insertedIds.length).toBe(1);
    createdSpecimenIds.push(...finalJob.insertedIds);

    // Realtime progress events received, no Private specimen fields leaked
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    const lastEvt = progressEvents[progressEvents.length - 1];
    expect(lastEvt.status).toBe("done");
    expect(lastEvt.percent).toBe(100);
    expect(lastEvt.commonNameVn).toBeUndefined();

    // ES outbox recorded inside transaction
    const outboxRows = await knex("es_sync_outbox").where("entity_id", finalJob.insertedIds[0]);
    expect(outboxRows.length).toBeGreaterThanOrEqual(1);
  });

  it("4. Image processing: generates 200x200 thumbnail, strips EXIF metadata on Public copy, and rejects spoofed magic bytes", async () => {
    // Fake JPEG (text file masquerading as image/jpeg) -> rejected
    const fakeBuf = Buffer.from("<html><script>alert(1)</script></html>");
    expect(mediaService.detectImageMagicBytes(fakeBuf)).toBeNull();

    // Real 600x400 JPEG with EXIF metadata
    const realJpeg = await sharp({
      create: { width: 600, height: 400, channels: 3, background: { r: 20, g: 100, b: 50 } },
    })
      .withMetadata({ exif: { IFD0: { ImageDescription: "GPS-SENSITIVE-EXIF" } } })
      .jpeg()
      .toBuffer();

    const detected = mediaService.detectImageMagicBytes(realJpeg);
    expect(detected).toEqual({ ext: "jpg", mime: "image/jpeg" });

    const processed = await mediaService.processUploadedImage(realJpeg, "jpg");
    const thumbMeta = await sharp(processed.thumbnailBuffer).metadata();
    expect(thumbMeta.width).toBe(200);
    expect(thumbMeta.height).toBe(200);

    // Public copy must have EXIF stripped
    const publicMeta = await sharp(processed.publicBuffer).metadata();
    expect(publicMeta.exif).toBeUndefined();
  });
});
