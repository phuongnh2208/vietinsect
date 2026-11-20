"use strict";

const knex = require("../../config/knex");
const logger = require("../../config/logger");

let debounceTimer = null;
let isRefreshing = false;

async function refreshTaxonViewNow() {
  if (isRefreshing) return false;
  isRefreshing = true;
  try {
    await knex.raw("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_taxon_dwc_flat");
    logger.info("[MV REFRESH] Đã làm mới mv_taxon_dwc_flat thành công (CONCURRENTLY)");
    return true;
  } catch (err) {
    logger.error(`[MV REFRESH ERROR] Không thể làm mới mv_taxon_dwc_flat: ${err?.message}`);
    return false;
  } finally {
    isRefreshing = false;
  }
}

/**
 * DEF-110: Debounce 30 giây, chạy nền, lỗi chỉ ghi log không làm fail request.
 */
function scheduleRefreshTaxonView(delayMs = 30000) {
  if (process.env.NODE_ENV === "test") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    refreshTaxonViewNow().catch(() => {});
  }, delayMs);
  if (typeof debounceTimer.unref === "function") {
    debounceTimer.unref();
  }
}

module.exports = {
  refreshTaxonViewNow,
  scheduleRefreshTaxonView,
};
