const bcrypt = require("bcrypt");

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Cách dùng: node scripts/generateHash.js \"<mat_khau_manh_>=12_ky_tu>\"");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log("Bcrypt Hash (cost=12):", hash);
});
