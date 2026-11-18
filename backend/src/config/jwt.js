require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 64 || JWT_SECRET === "vietinsect_secret") {
  throw new Error(
    "CRITICAL: JWT_SECRET phải được cấu hình ngẫu nhiên >= 64 ký tự và tách biệt hoàn toàn với khóa AES.",
  );
}

const JWT_ACCESS_EXPIRES_IN = "15m";
const JWT_REFRESH_EXPIRES_IN = "7d";
const JWT_EXPIRES_IN = JWT_ACCESS_EXPIRES_IN;

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_EXPIRES_IN,
};
