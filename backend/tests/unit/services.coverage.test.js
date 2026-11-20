"use strict";

jest.mock("../../src/modules/auth/auth.repository");
jest.mock("../../src/modules/dna/dna.repository");
jest.mock("../../src/modules/specimen/specimen.repository");
jest.mock("../../src/modules/taxonomy/taxonomy.repository");
jest.mock("../../src/modules/system/system.repository");
jest.mock("../../src/modules/media/media.repository");
jest.mock("../../src/config/minio", () => ({
  putObjectToMinio: jest.fn().mockResolvedValue({}),
  deleteObjectFromMinio: jest.fn().mockResolvedValue({}),
  getObjectFromMinio: jest.fn().mockResolvedValue({
    statusCode: 200,
    body: Buffer.from("img"),
    headers: { "content-type": "image/jpeg" },
  }),
  MINIO_BUCKET: "vietinsect-media",
}));
jest.mock("axios", () => ({
  get: jest.fn(),
}));
jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue("$2b$12$mockedhash"),
}));

const axios = require("axios");
const bcrypt = require("bcrypt");
const ncbiService = require("../../src/modules/dna/ncbi.service");
const authRepo = require("../../src/modules/auth/auth.repository");
const authService = require("../../src/modules/auth/auth.service");

const dnaRepo = require("../../src/modules/dna/dna.repository");
const dnaService = require("../../src/modules/dna/dna.service");

const specRepo = require("../../src/modules/specimen/specimen.repository");
const specService = require("../../src/modules/specimen/specimen.service");

const taxRepo = require("../../src/modules/taxonomy/taxonomy.repository");
const taxService = require("../../src/modules/taxonomy/taxonomy.service");

const sysRepo = require("../../src/modules/system/system.repository");
const sysService = require("../../src/modules/system/system.service");

const mediaRepo = require("../../src/modules/media/media.repository");
const mediaService = require("../../src/modules/media/media.service");

describe("DEF-105: Business Logic Service Unit Tests (Coverage >= 70%)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. auth.service.js ───────────────────────────────────────────────
  describe("auth.service", () => {
    test("login succeeds with valid credentials and stores refresh token", async () => {
      authRepo.findByUsername.mockResolvedValue({
        admin_id: 1,
        username: "admin",
        full_name: "Admin User",
        email: "admin@vast.vn",
        password_hash: "hash",
        failed_login_attempts: 0,
        locked_until: null,
      });
      bcrypt.compare.mockResolvedValue(true);
      authRepo.resetFailedAttempts.mockResolvedValue();
      authRepo.saveRefreshToken.mockResolvedValue();

      const res = await authService.login("admin", "ValidPass123!");
      expect(res.accessToken).toBeTruthy();
      expect(res.refreshTokenRaw).toBeTruthy();
      expect(res.user.username).toBe("admin");
    });

    test("login throws on unknown user, wrong password, and locked account", async () => {
      authRepo.findByUsername.mockResolvedValue(null);
      await expect(authService.login("ghost", "bad")).rejects.toThrow();

      authRepo.findByUsername.mockResolvedValue({
        admin_id: 2,
        username: "admin2",
        password_hash: "hash",
        failed_login_attempts: 4,
        locked_until: null,
      });
      bcrypt.compare.mockResolvedValue(false);
      authRepo.incrementFailedAttempts.mockResolvedValue();
      await expect(authService.login("admin2", "wrong")).rejects.toThrow();
      expect(authRepo.incrementFailedAttempts).toHaveBeenCalled();

      authRepo.findByUsername.mockResolvedValue({
        admin_id: 2,
        username: "admin2",
        password_hash: "hash",
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 600000),
      });
      await expect(authService.login("admin2", "any")).rejects.toThrow();
    });

    test("refresh issues new accessToken and rejects invalid token", async () => {
      authRepo.findRefreshToken.mockResolvedValue(null);
      await expect(authService.refresh("bad-token")).rejects.toThrow();

      authRepo.findRefreshToken.mockResolvedValue({
        token_id: 1,
        admin_id: 1,
      });
      authRepo.findById.mockResolvedValue({
        admin_id: 1,
        username: "admin",
        full_name: "Admin",
        email: "a@b.c",
      });
      const res = await authService.refresh("good-token");
      expect(res.accessToken).toBeTruthy();
      expect(res.user.username).toBe("admin");
    });

    test("changePassword, logout, and logoutAll work correctly", async () => {
      authRepo.findByIdWithHash.mockResolvedValue(null);
      await expect(authService.changePassword(1, "old", "NewPass@123456")).rejects.toThrow();

      authRepo.findByIdWithHash.mockResolvedValue({
        admin_id: 1,
        username: "admin",
        password_hash: "oldhash",
      });
      bcrypt.compare.mockResolvedValueOnce(false);
      await expect(authService.changePassword(1, "wrong", "NewPass@123456")).rejects.toThrow();

      bcrypt.compare.mockResolvedValueOnce(true);
      authRepo.updatePasswordHash.mockResolvedValue();
      authRepo.revokeAllRefreshTokens.mockResolvedValue();
      await authService.changePassword(1, "old", "NewPass@123456");
      expect(authRepo.updatePasswordHash).toHaveBeenCalled();

      authRepo.revokeRefreshToken.mockResolvedValue();
      await authService.logout("some-refresh-token");
      await authService.logout("");
      await authService.logoutAll(1);
      expect(authRepo.revokeAllRefreshTokens).toHaveBeenCalledWith(1);
    });
  });

  // ── 2. dna.service.js ────────────────────────────────────────────────
  describe("dna.service", () => {
    const sampleDnaRow = {
      dna_id: 10,
      specimen_id: 5,
      specimen_code: "VN-005",
      taxon_id: 1,
      taxon_name: "Papilio demoleus",
      taxon_rank: "Species",
      taxon_slug: "papilio-demoleus",
      scientific_name_verbatim: "Papilio demoleus",
      genbank_accession: "OR123456",
      bold_process_id: "BOLD001",
      gene_marker: "COI",
      fasta_sequence: "ATGCGCGTATATGCGC",
      sequence_length_bp: 16,
      gc_content_pct: 56.3,
      submission_date: new Date("2024-05-01"),
      source_db: "GENBANK",
      is_public: true,
      is_orphaned: false,
    };

    test("listDna, getDnaById, getStats, error branches", async () => {
      dnaRepo.findMany.mockResolvedValue({
        items: [sampleDnaRow],
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      const list = await dnaService.listDna({}, { isAdmin: false });
      expect(list.items).toHaveLength(1);

      dnaRepo.findById.mockResolvedValue(sampleDnaRow);
      const detail = await dnaService.getDnaById(10, { isAdmin: false });
      expect(detail.id).toBe(10);

      dnaRepo.findById.mockResolvedValue(null);
      await expect(dnaService.getDnaById(999, { isAdmin: false })).rejects.toThrow();

      dnaRepo.getStats.mockResolvedValue({ totalSequences: 1 });
      expect((await dnaService.getStats({ isAdmin: false })).totalSequences).toBe(1);
    });

    test("createDna, updateDna, togglePublic, deleteDna + validation errors", async () => {
      dnaRepo.taxonExists.mockResolvedValue(false);
      await expect(dnaService.createDna({ taxonId: 999 }, 1)).rejects.toThrow();

      dnaRepo.taxonExists.mockResolvedValue(true);
      dnaRepo.specimenExists.mockResolvedValue(false);
      await expect(dnaService.createDna({ taxonId: 1, specimenId: 999 }, 1)).rejects.toThrow();

      dnaRepo.specimenExists.mockResolvedValue(true);
      dnaRepo.findByAccession.mockResolvedValue({ dna_id: 99 });
      await expect(
        dnaService.createDna({ taxonId: 1, genbankAccession: "OR123456" }, 1),
      ).rejects.toThrow();

      dnaRepo.findByAccession.mockResolvedValue(null);
      dnaRepo.findByBoldId.mockResolvedValue(null);
      dnaRepo.create.mockResolvedValue(10);
      dnaRepo.findById.mockResolvedValue(sampleDnaRow);

      const created = await dnaService.createDna(
        {
          taxonId: 1,
          specimenId: 5,
          genbankAccession: "OR123456",
          fastaSequence: ">header\nATGCGCGTATATGCGC",
        },
        1,
      );
      expect(created.id).toBe(10);

      dnaRepo.update.mockResolvedValue();
      const updated = await dnaService.updateDna(10, { notes: "updated", fastaSequence: "ACGTACGT" }, 1);
      expect(updated.id).toBe(10);

      const toggled = await dnaService.togglePublic(10, false, 1);
      expect(toggled.id).toBe(10);

      dnaRepo.remove.mockResolvedValue();
      await dnaService.deleteDna(10, 1);
      expect(dnaRepo.remove).toHaveBeenCalledWith(10);
    });
  });

  // ── 3. specimen.service.js ───────────────────────────────────────────
  describe("specimen.service", () => {
    const sampleSpecRow = {
      specimen_id: 100,
      specimen_code: "VN-2024-0001",
      taxon_id: 1,
      taxon_name: "Papilio demoleus",
      taxon_rank: "Species",
      gbif_scientific_name: "Papilio demoleus",
      collection_date: new Date("2024-05-01"),
      latitude: 21.02,
      longitude: 105.85,
      is_public: true,
      images: [
        {
          image_id: 1,
          object_key: "specimens/100/a.jpg",
          is_public: true,
          license_code: "cc-by",
          uploaded_at: new Date(),
        },
      ],
      dnaSequences: [
        {
          dna_id: 10,
          gene_marker: "COI",
          genbank_accession: "OR123456",
          sequence_length_bp: 650,
          is_public: true,
        },
      ],
      changeHistory: [
        {
          history_id: 1,
          field_name: "notes",
          old_value: "a",
          new_value: "b",
          changed_at: new Date(),
        },
      ],
      speciesImages: [],
      speciesDnaSequences: [],
    };

    test("list, map, detail, lookups, stats, analytics", async () => {
      specRepo.findMany.mockResolvedValue({
        items: [sampleSpecRow],
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      const list = await specService.listSpecimens({}, { isAdmin: false });
      expect(list.items).toHaveLength(1);

      specRepo.findMapData.mockResolvedValue({ points: [], provinceClusters: [], heatGrid: [] });
      expect((await specService.getMapOccurrences({}, { isAdmin: false })).points).toEqual([]);

      specRepo.findById.mockResolvedValue(sampleSpecRow);
      const detail = await specService.getSpecimenById(100, { isAdmin: true });
      expect(detail.images).toHaveLength(1);
      expect(detail.dnaSequences).toHaveLength(1);
      expect(detail.changeHistory).toHaveLength(1);

      specRepo.findById.mockResolvedValue(null);
      await expect(specService.getSpecimenById(999, { isAdmin: false })).rejects.toThrow();

      specRepo.findLookups.mockResolvedValue({ orders: [], provinces: [] });
      expect(await specService.getLookups()).toEqual({ orders: [], provinces: [] });

      specRepo.getStats.mockResolvedValue({ totalSpecimens: 1 });
      expect((await specService.getStats({ isAdmin: false })).totalSpecimens).toBe(1);

      specRepo.getAnalytics.mockResolvedValue({ byYear: [] });
      expect((await specService.getAnalytics({}, { isAdmin: false })).byYear).toEqual([]);
    });

    test("create, update, toggle, batch, bulkImport, delete & restore", async () => {
      specRepo.taxonExists.mockResolvedValue(true);
      specRepo.provinceExists.mockResolvedValue(true);
      specRepo.findRegistryByCode.mockResolvedValue(null);
      specRepo.create.mockResolvedValue(100);
      specRepo.findById.mockResolvedValue(sampleSpecRow);

      await expect(
        specService.createSpecimen({ taxonId: 1, latitude: 21.0 }, 1),
      ).rejects.toThrow();

      const created = await specService.createSpecimen(
        { taxonId: 1, provinceId: 1, collectionDate: "2024-05-01" },
        1,
      );
      expect(created.id).toBe(100);

      specRepo.update.mockResolvedValue();
      const updated = await specService.updateSpecimen(100, { notes: "ok" }, 1);
      expect(updated.id).toBe(100);

      const toggled = await specService.togglePublic(100, false, 1);
      expect(toggled.id).toBe(100);

      specRepo.batchUpdatePublic.mockResolvedValue(2);
      expect((await specService.batchTogglePublic([1, 2], false, 1)).updatedCount).toBe(2);

      expect((await specService.batchUpdateSpecimens([], {}, 1)).updatedCount).toBe(0);
      specRepo.batchUpdateFields.mockResolvedValue(2);
      expect((await specService.batchUpdateSpecimens([1, 2], { sex: "male" }, 1)).updatedCount).toBe(2);

      expect((await specService.bulkImportSpecimens([], 1)).insertedCount).toBe(0);
      await expect(
        specService.bulkImportSpecimens(new Array(5001).fill({}), 1),
      ).rejects.toThrow();

      specRepo.softDelete.mockResolvedValue({ deletedCount: 1, orphanedDnaCount: 2 });
      const delRes = await specService.deleteSpecimen(100, 1);
      expect(delRes.orphanedDnaCount).toBe(2);
      expect(delRes.warning).toBeTruthy();

      specRepo.restore.mockResolvedValue({ restoredCount: 1, unorphanedDnaCount: 2 });
      expect((await specService.restoreSpecimen(100, 1)).unorphanedDnaCount).toBe(2);
    });
  });

  // ── 4. taxonomy.service.js ───────────────────────────────────────────
  describe("taxonomy.service", () => {
    const sampleTaxon = {
      taxon_id: 7,
      parent_id: 6,
      taxon_rank: "Species",
      scientific_name: "Papilio demoleus",
      slug: "papilio-demoleus",
      taxonomic_status: "accepted",
    };

    test("getTree, getChildren, searchTaxa, getTaxonById, getSpeciesProfile", async () => {
      taxRepo.findByRanks.mockResolvedValue([sampleTaxon]);
      taxRepo.countChildrenByParentIds.mockResolvedValue([{ parent_id: 7, count: 0 }]);
      taxRepo.countSpecimensRollup.mockResolvedValue([{ taxon_id: 7, count: 3 }]);
      const tree = await taxService.getTree({ isAdmin: false });
      expect(Array.isArray(tree)).toBe(true);

      taxRepo.findById.mockResolvedValue({ ...sampleTaxon, taxon_id: 6, taxon_rank: "Genus" });
      taxRepo.findChildren.mockResolvedValue([sampleTaxon]);
      taxRepo.countChildrenByParentIds.mockResolvedValue([]);
      taxRepo.countSpecimensByTaxonIds.mockResolvedValue([{ taxon_id: 7, count: 3 }]);
      const children = await taxService.getChildren(6, { isAdmin: false });
      expect(children).toHaveLength(1);

      taxRepo.search.mockResolvedValue([sampleTaxon]);
      expect(await taxService.searchTaxa("Papilio")).toHaveLength(1);

      taxRepo.findById.mockResolvedValue(sampleTaxon);
      taxRepo.countSpecimens.mockResolvedValue(3);
      const t = await taxService.getTaxonById(7, { isAdmin: false });
      expect(t.scientificName).toBe("Papilio demoleus");

      taxRepo.findBySlug.mockResolvedValue(sampleTaxon);
      taxRepo.findProfile.mockResolvedValue(null);
      taxRepo.listBioactivity.mockResolvedValue([]);
      const sp = await taxService.getSpeciesProfile("papilio-demoleus", { isAdmin: false });
      expect(sp.slug).toBe("papilio-demoleus");
    });

    test("createTaxon, updateTaxon, setSynonym, clearSynonym, deleteTaxon, profile & bioactivity", async () => {
      taxRepo.findById.mockResolvedValue({ ...sampleTaxon, taxon_id: 6, taxon_rank: "Genus" });
      taxRepo.findByScientificName.mockResolvedValue(null);
      taxRepo.findBySlug.mockResolvedValue(null);
      taxRepo.create.mockResolvedValue(sampleTaxon);

      const created = await taxService.createTaxon(
        { parentId: 6, taxonRank: "Species", scientificName: "Papilio demoleus" },
        1,
      );
      expect(created.taxon.scientificName).toBe("Papilio demoleus");

      taxRepo.findById.mockResolvedValue(sampleTaxon);
      taxRepo.update.mockResolvedValue(sampleTaxon);
      const updated = await taxService.updateTaxon(7, { vernacularNameVn: "Bướm" }, 1);
      expect(updated.id).toBe(7);

      taxRepo.findById.mockResolvedValueOnce(sampleTaxon).mockResolvedValueOnce({ ...sampleTaxon, taxon_id: 8 });
      taxRepo.setSynonym.mockResolvedValue({ ...sampleTaxon, taxonomic_status: "synonym", accepted_taxon_id: 8 });
      const syn = await taxService.setSynonym(7, 8);
      expect(syn.taxonomicStatus).toBe("synonym");

      taxRepo.findById.mockResolvedValue(sampleTaxon);
      taxRepo.clearSynonym.mockResolvedValue(sampleTaxon);
      const cleared = await taxService.clearSynonym(7);
      expect(cleared.taxonomicStatus).toBe("accepted");

      taxRepo.countChildren.mockResolvedValue(0);
      taxRepo.countSpecimens.mockResolvedValue(0);
      taxRepo.remove.mockResolvedValue();
      await taxService.deleteTaxon(7);
      expect(taxRepo.remove).toHaveBeenCalledWith(7);

      taxRepo.upsertProfile.mockResolvedValue({ taxon_id: 7, morphology_description: "desc" });
      expect(await taxService.upsertSpeciesProfile(7, { morphologyDescription: "desc" })).toBeTruthy();

      taxRepo.createBioactivity.mockResolvedValue({ bioactivity_id: 1, activity_type: "antimicrobial" });
      expect(await taxService.addBioactivity(7, { activityType: "antimicrobial" }, 1)).toBeTruthy();

      taxRepo.removeBioactivity.mockResolvedValue();
      await taxService.removeBioactivity(1);
    });
  });

  // ── 5. system.service.js ─────────────────────────────────────────────
  describe("system.service", () => {
    test("logAudit, listAuditLogs, listConfigs, updateConfig (including secret encryption)", async () => {
      sysRepo.insertAuditLog.mockResolvedValue();
      await sysService.logAudit({
        adminId: 1,
        actionType: "LOGIN",
        targetTable: "admin_users",
        targetId: 1,
        ipAddress: "127.0.0.1",
      });
      expect(sysRepo.insertAuditLog).toHaveBeenCalled();

      sysRepo.findAuditLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      });
      expect((await sysService.listAuditLogs({})).items).toEqual([]);

      sysRepo.findAllConfigs.mockResolvedValue([
        {
          config_key: "smtp_host",
          config_value: "smtp.vast.vn",
          config_category: "smtp",
          updated_at: new Date(),
        },
        {
          config_key: "smtp_password",
          config_value: { __encrypted: true, iv: "aa", tag: "bb", data: "cc" },
          config_category: "smtp",
          updated_at: new Date(),
        },
      ]);
      const cfgs = await sysService.listConfigs();
      expect(cfgs).toHaveLength(2);

      sysRepo.upsertConfig.mockResolvedValue({
        config_key: "smtp_password",
        config_value: { __encrypted: true },
        config_category: "smtp",
      });
      const saved = await sysService.updateConfig("smtp_password", "supersecret", "smtp", 1);
      expect(saved).toBeTruthy();
    });
  });

  // ── 6. media.service.js ──────────────────────────────────────────────
  describe("media.service", () => {
    test("listMedia, getStats, getMediaFile, uploadMedia, deleteMedia", async () => {
      mediaRepo.findMany.mockResolvedValue({
        items: [
          {
            image_id: 1,
            specimen_id: 100,
            object_key: "specimens/100/a.jpg",
            license_code: "cc-by",
            is_public: true,
            specimen_is_public: true,
            collection_date: new Date("2024-05-01"),
          },
        ],
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
      });
      const list = await mediaService.listMedia({}, { isAdmin: false });
      expect(list.items).toHaveLength(1);

      mediaRepo.getStats.mockResolvedValue({ totalImages: 1 });
      expect((await mediaService.getStats({ isAdmin: false })).totalImages).toBe(1);

      mediaRepo.findByIdWithSpecimen.mockResolvedValue({
        image_id: 1,
        object_key: "specimens/100/a.jpg",
        img_is_public: true,
        specimen_is_public: true,
      });
      const file = await mediaService.getMediaFile(1, { isAdmin: false });
      expect(file.contentType).toBe("image/jpeg");

      mediaRepo.findByIdWithSpecimen.mockResolvedValue({
        image_id: 2,
        object_key: "specimens/100/b.jpg",
        img_is_public: false,
        specimen_is_public: true,
      });
      await expect(mediaService.getMediaFile(2, { isAdmin: false })).rejects.toThrow();

      specRepo.findById.mockResolvedValue({
        specimen_id: 100,
        specimen_code: "VN-100",
        is_public: true,
      });
      mediaRepo.create.mockResolvedValue({
        image_id: 3,
        specimen_id: 100,
        object_key: "specimens/100/c.jpg",
        license_code: "cc-by",
        is_public: true,
      });
      const uploaded = await mediaService.uploadMedia({
        file: { originalname: "bug.jpg", buffer: Buffer.from("x"), mimetype: "image/jpeg", size: 1 },
        body: { specimenId: 100, licenseCode: "cc-by" },
        adminId: 1,
      });
      expect(uploaded.id).toBe(3);

      mediaRepo.findById.mockResolvedValue({ image_id: 3, object_key: "specimens/100/c.jpg" });
      mediaRepo.remove.mockResolvedValue();
      await mediaService.deleteMedia(3);
      expect(mediaRepo.remove).toHaveBeenCalledWith(3);
    });
  });

  // ── 7. ncbi.service.js ───────────────────────────────────────────────
  describe("ncbi.service", () => {
    test("fetchGenBankByAccession parses GenBank flat-file entry", async () => {
      axios.get.mockResolvedValueOnce({
        data: [
          "LOCUS       OR123456                  16 bp    DNA     linear   INV 01-MAY-2024",
          "DEFINITION  Papilio demoleus cytochrome oxidase subunit I (COI) gene.",
          "ACCESSION   OR123456",
          "  ORGANISM  Papilio demoleus",
          "            Eukaryota; Metazoa; Arthropoda; Insecta; Lepidoptera; Papilionidae;",
          "            Papilio.",
          "  AUTHORS   Nguyen,V.A.",
          "ORIGIN",
          "        1 atgcgcgtat atgcgc",
          "//",
        ].join("\n"),
      });

      const res = await ncbiService.fetchGenBankByAccession("OR123456");
      expect(res).toBeTruthy();
      expect(res.genbankAccession).toBe("OR123456");
      expect(res.geneMarker).toBe("COI");
      expect(res.sequenceLengthBp).toBe(16);
    });
  });
});
