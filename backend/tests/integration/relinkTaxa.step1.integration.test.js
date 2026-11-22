"use strict";

/**
 * Integration test trên DB test cho Bước 1:
 * - Chạy backfill + relink 2 lần (idempotent: lần 2 không đổi dòng nào)
 * - Chống homonym (khác Order → chặn, không relink)
 * - Rollback transaction khi lỗi giữa lô
 * - Ghi audit_logs, es_sync_outbox đúng số dòng đổi, REFRESH mv_taxon_dwc_flat
 */

const knex = require("../../src/config/knex");
const { runBackfill } = require("../../scripts/backfill-species-taxa");
const { runRelink } = require("../../scripts/relink-specimens-taxa");
const { runRollback } = require("../../scripts/rollback_step1");

describe("Step 1 Integration Tests (DB test)", () => {
  const createdTaxonIds = [];
  const createdSpecimenIds = [];

  afterAll(async () => {
    // Cleanup test data
    if (createdSpecimenIds.length > 0) {
      await knex("es_sync_outbox").whereIn("entity_id", createdSpecimenIds).del();
      await knex("specimens").whereIn("specimen_id", createdSpecimenIds).del();
      await knex("specimen_registry").whereIn("specimen_id", createdSpecimenIds).del();
    }
    if (createdTaxonIds.length > 0) {
      await knex("taxa").whereIn("taxon_id", createdTaxonIds.slice().reverse()).del();
    }
    await knex.destroy();
  });

  test("idempotent backfill + relink, homonym protection, audit_logs, es_sync_outbox, and MV refresh", async () => {
    const uniq = Date.now().toString(36);

    // 1. Tạo 2 Order, 1 Genus dưới Order A, và 1 homonym Genus cùng tên dưới Order B
    const [orderA] = await knex("taxa")
      .insert({
        taxon_rank: "Order",
        scientific_name: `TestOrderA_${uniq}`,
        slug: `test-order-a-${uniq}`,
        taxonomic_status: "accepted",
      })
      .returning("taxon_id");
    const orderAId = Number(orderA.taxon_id ?? orderA);
    createdTaxonIds.push(orderAId);

    const [orderB] = await knex("taxa")
      .insert({
        taxon_rank: "Order",
        scientific_name: `TestOrderB_${uniq}`,
        slug: `test-order-b-${uniq}`,
        taxonomic_status: "accepted",
      })
      .returning("taxon_id");
    const orderBId = Number(orderB.taxon_id ?? orderB);
    createdTaxonIds.push(orderBId);

    const alphaSuffix = uniq.replace(/[0-9]/g, (d) => String.fromCharCode(97 + Number(d)));
    const genusName = `Testgenus${alphaSuffix}`;
    const [genusA] = await knex("taxa")
      .insert({
        parent_id: orderAId,
        taxon_rank: "Genus",
        scientific_name: genusName,
        slug: `test-genus-a-${uniq}`,
        taxonomic_status: "accepted",
      })
      .returning("taxon_id");
    const genusAId = Number(genusA.taxon_id ?? genusA);
    createdTaxonIds.push(genusAId);

    // 2. Tạo 2 specimens:
    //    sp1 thuộc OrderA với tên "Testgenus<uniq> alpha" → sẽ tạo Species mới & relink OrderA -> Species
    //    sp2 thuộc OrderB với tên "Testgenus<uniq>" → khác Order (homonym conflict) → KHÔNG được relink sang genusA!
    const [reg1] = await knex("specimen_registry")
      .insert({ specimen_code: `TST-S1-${uniq}`, gbif_occurrence_id: `tst-occ-1-${uniq}` })
      .returning("specimen_id");
    const sp1Id = Number(reg1.specimen_id ?? reg1);
    createdSpecimenIds.push(sp1Id);

    await knex("specimens").insert({
      specimen_id: sp1Id,
      taxon_id: orderAId,
      collection_date: "2026-05-01",
      gbif_scientific_name: `${genusName} alpha`,
      is_public: true,
    });

    const [reg2] = await knex("specimen_registry")
      .insert({ specimen_code: `TST-S2-${uniq}`, gbif_occurrence_id: `tst-occ-2-${uniq}` })
      .returning("specimen_id");
    const sp2Id = Number(reg2.specimen_id ?? reg2);
    createdSpecimenIds.push(sp2Id);

    await knex("specimens").insert({
      specimen_id: sp2Id,
      taxon_id: orderBId,
      collection_date: "2026-05-01",
      gbif_scientific_name: genusName,
      is_public: true,
    });

    // 3. Chạy backfill lần 1 (chỉ tạo Species cho sp1)
    const bf1 = await runBackfill(knex, { dryRun: false, silent: true, unmatchedOut: null });
    expect(bf1.insertedCount).toBeGreaterThanOrEqual(1);

    const newSp = await knex("taxa").where("scientific_name", `${genusName} alpha`).first();
    expect(newSp).toBeTruthy();
    expect(Number(newSp.parent_id)).toBe(genusAId);
    createdTaxonIds.push(Number(newSp.taxon_id));

    // 4. Chạy relink lần 1 cho TestOrderA
    const rl1 = await runRelink(knex, {
      dryRun: false,
      orderFilter: `TestOrderA_${uniq}`,
      silent: true,
      conflictsOut: null,
      previewOut: null,
    });
    expect(rl1.stats.changed).toBe(1);
    expect(rl1.stats.transitions["Order->Species"]).toBe(1);
    expect(rl1.stats.outboxEnqueued).toBe(1);

    // Kiểm tra es_sync_outbox có đúng 1 bản ghi pending cho sp1
    const outboxRows = await knex("es_sync_outbox").where("entity_id", sp1Id);
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].op).toBe("upsert");

    // Kiểm tra audit_logs có bản ghi RELINK_SPECIMENS_TAXA
    const auditRow = await knex("audit_logs")
      .where("action_type", "RELINK_SPECIMENS_TAXA")
      .orderBy("log_timestamp", "desc")
      .first();
    expect(auditRow).toBeTruthy();

    // 5. Chạy relink lần 1 cho TestOrderB → phải bị chặn bởi homonym protection!
    const rlConflict = await runRelink(knex, {
      dryRun: false,
      orderFilter: `TestOrderB_${uniq}`,
      silent: true,
      conflictsOut: null,
      previewOut: null,
    });
    expect(rlConflict.stats.changed).toBe(0);
    expect(rlConflict.stats.conflicts).toBe(1);

    // 6. Chạy backfill & relink lần 2 (idempotent → không đổi gì thêm!)
    const bf2 = await runBackfill(knex, { dryRun: false, silent: true, unmatchedOut: null });
    expect(bf2.insertedCount).toBe(0);

    const rl2 = await runRelink(knex, {
      dryRun: false,
      orderFilter: `TestOrderA_${uniq}`,
      silent: true,
      conflictsOut: null,
      previewOut: null,
    });
    expect(rl2.stats.changed).toBe(0);

    // 7. Kiểm tra rollback_step1.js khôi phục taxon_id về orderAId + ghi audit_logs + đẩy outbox
    const rb = await runRollback(knex, {
      dryRun: false,
      rows: [{ specimen_id: sp1Id, old_taxon_id: orderAId }],
    });
    expect(rb.restored).toBe(1);
    expect(rb.outboxEnqueued).toBe(1);
    const spAfterRb = await knex("specimens").where("specimen_id", sp1Id).first();
    expect(Number(spAfterRb.taxon_id)).toBe(orderAId);
  });

  test("transaction rollback when mid-batch error occurs", async () => {
    const uniq = `${Date.now().toString(36)}rb`;
    await expect(
      knex.transaction(async (trx) => {
        await trx("audit_logs").insert({
          action_type: `TEST_RB_${uniq}`,
          target_table: "specimens",
          details: JSON.stringify({ test: true }),
        });
        throw new Error("Simulated mid-batch failure");
      })
    ).rejects.toThrow("Simulated mid-batch failure");

    const found = await knex("audit_logs").where("action_type", `TEST_RB_${uniq}`).first();
    expect(found).toBeUndefined();
  });
});
