const JWT_SECRET = process.env.JWT_SECRET || "doi_chuoi_bi_mat_nay_sau";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_doi_sau_trong_production";
const JWT_ACCESS_EXPIRES_IN = "15m";
const JWT_REFRESH_EXPIRES_IN = "7d";
// Giữ JWT_EXPIRES_IN để không break import cũ
const JWT_EXPIRES_IN = JWT_ACCESS_EXPIRES_IN;

module.exports = { JWT_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, JWT_EXPIRES_IN };
