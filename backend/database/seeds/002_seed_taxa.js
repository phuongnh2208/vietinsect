/**
 * Seed 002 – Cây phân loại (Taxa) cơ sở
 *
 * Hierarchy:
 *   Kingdom: Animalia
 *     Phylum: Arthropoda
 *       Class: Insecta
 *         16 Orders (theo GBIF taxonKey chính thức)
 *
 * SRS §6.5: dùng Knex; slug sinh bởi hàm slugify() đồng bộ với taxonomy.service.js
 *
 * Chạy: cd backend && npx knex seed:run --specific=002_seed_taxa.js
 */

/** Hàm slugify đồng bộ với taxonomy.service.js */
function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

exports.seed = async (knex) => {
  // ─── Kiểm tra xem đã có taxa chưa (tránh re-seed trùng) ───────────────────
  const existing = await knex("taxa").count("taxon_id as cnt").first();
  if (parseInt(existing.cnt, 10) > 0) {
    console.log(
      `[seed_taxa] Bảng taxa đã có ${existing.cnt} bản ghi – bỏ qua seed.`
    );
    console.log(
      `[seed_taxa] Nếu muốn reset, chạy: knex seed:run --specific=002_seed_taxa.js sau khi truncate bảng thủ công.`
    );
    return;
  }

  // ─── Dữ liệu 16 Orders Insecta (GBIF taxonKey xác nhận 18/11/2026) ─────────
  const INSECTA_ORDERS = [
    { scientific_name: "Coleoptera",    gbif_taxon_key: "1470", vernacular_name_vn: "Bọ cánh cứng",      vernacular_name_en: "Beetles" },
    { scientific_name: "Lepidoptera",   gbif_taxon_key: "797",  vernacular_name_vn: "Bướm và Ngài",       vernacular_name_en: "Butterflies & Moths" },
    { scientific_name: "Hymenoptera",   gbif_taxon_key: "1457", vernacular_name_vn: "Ong, Kiến, Nhện ký sinh", vernacular_name_en: "Ants, Bees & Wasps" },
    { scientific_name: "Diptera",       gbif_taxon_key: "811",  vernacular_name_vn: "Ruồi và Muỗi",       vernacular_name_en: "Flies & Mosquitoes" },
    { scientific_name: "Hemiptera",     gbif_taxon_key: "809",  vernacular_name_vn: "Bọ xít và Ve",        vernacular_name_en: "True Bugs & Cicadas" },
    { scientific_name: "Orthoptera",    gbif_taxon_key: "1458", vernacular_name_vn: "Châu chấu và Dế",    vernacular_name_en: "Grasshoppers & Crickets" },
    { scientific_name: "Odonata",       gbif_taxon_key: "789",  vernacular_name_vn: "Chuồn chuồn",        vernacular_name_en: "Dragonflies & Damselflies" },
    { scientific_name: "Blattodea",     gbif_taxon_key: "800",  vernacular_name_vn: "Gián",                vernacular_name_en: "Cockroaches & Termites" },
    { scientific_name: "Mantodea",      gbif_taxon_key: "788",  vernacular_name_vn: "Bọ ngựa",            vernacular_name_en: "Mantises" },
    { scientific_name: "Neuroptera",    gbif_taxon_key: "1501", vernacular_name_vn: "Cánh gân",            vernacular_name_en: "Lacewings & Ant-lions" },
    { scientific_name: "Trichoptera",   gbif_taxon_key: "1003", vernacular_name_vn: "Ruồi đá",             vernacular_name_en: "Caddisflies" },
    { scientific_name: "Ephemeroptera", gbif_taxon_key: "1225", vernacular_name_vn: "Phù du",              vernacular_name_en: "Mayflies" },
    { scientific_name: "Plecoptera",    gbif_taxon_key: "787",  vernacular_name_vn: "Ruồi đá cuội",       vernacular_name_en: "Stoneflies" },
    { scientific_name: "Thysanoptera",  gbif_taxon_key: "1228", vernacular_name_vn: "Bọ trĩ",              vernacular_name_en: "Thrips" },
    { scientific_name: "Dermaptera",    gbif_taxon_key: "1224", vernacular_name_vn: "Bọ đuôi kìm",        vernacular_name_en: "Earwigs" },
    // GBIF Backbone dùng "Phasmida" (key=1460), không phải "Phasmatodea"
    { scientific_name: "Phasmida",      gbif_taxon_key: "1460", vernacular_name_vn: "Bọ que / Bọ lá",     vernacular_name_en: "Stick Insects & Leaf Insects" },
  ];

  // ─── Insert theo thứ tự: Kingdom → Phylum → Class → Orders ────────────────
  const now = new Date();

  // 1. Kingdom Animalia
  const [animalia] = await knex("taxa")
    .insert({
      taxon_rank: "Kingdom",
      scientific_name: "Animalia",
      slug: slugify("Animalia"),
      taxonomic_status: "accepted",
      nomenclatural_code: "ICZN",
      gbif_taxon_key: "1",
      is_verified: true,
      created_at: now,
      updated_at: now,
    })
    .returning("taxon_id");

  const animaliaId = animalia.taxon_id ?? animalia;

  // 2. Phylum Arthropoda
  const [arthropoda] = await knex("taxa")
    .insert({
      parent_id: animaliaId,
      taxon_rank: "Phylum",
      scientific_name: "Arthropoda",
      slug: slugify("Arthropoda"),
      taxonomic_status: "accepted",
      nomenclatural_code: "ICZN",
      gbif_taxon_key: "54",
      is_verified: true,
      created_at: now,
      updated_at: now,
    })
    .returning("taxon_id");

  const arthropodaId = arthropoda.taxon_id ?? arthropoda;

  // 3. Class Insecta
  const [insecta] = await knex("taxa")
    .insert({
      parent_id: arthropodaId,
      taxon_rank: "Class",
      scientific_name: "Insecta",
      slug: slugify("Insecta"),
      taxonomic_status: "accepted",
      nomenclatural_code: "ICZN",
      gbif_taxon_key: "216",
      vernacular_name_vn: "Côn trùng",
      vernacular_name_en: "Insects",
      is_verified: true,
      created_at: now,
      updated_at: now,
    })
    .returning("taxon_id");

  const insectaId = insecta.taxon_id ?? insecta;

  // 4. 16 Orders
  const orderRows = INSECTA_ORDERS.map((o) => ({
    parent_id: insectaId,
    taxon_rank: "Order",
    scientific_name: o.scientific_name,
    slug: slugify(o.scientific_name),
    taxonomic_status: "accepted",
    nomenclatural_code: "ICZN",
    gbif_taxon_key: o.gbif_taxon_key,
    vernacular_name_vn: o.vernacular_name_vn,
    vernacular_name_en: o.vernacular_name_en,
    is_verified: true,
    created_at: now,
    updated_at: now,
  }));

  await knex("taxa").insert(orderRows);

  console.log("✅ Seed taxa hoàn tất:");
  console.log("   • 1 Kingdom (Animalia)");
  console.log("   • 1 Phylum (Arthropoda)");
  console.log("   • 1 Class (Insecta)");
  console.log(`   • ${INSECTA_ORDERS.length} Orders Insecta`);
};
