const JWT_SECRET = process.env.JWT_SECRET || "doi_chuoi_bi_mat_nay_sau";
const JWT_EXPIRES_IN = "24h";

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
