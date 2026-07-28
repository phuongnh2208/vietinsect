const bcrypt = require("bcrypt");
const password = process.argv[2] || "Admin@VietInsect2026";

bcrypt.hash(password, 12).then((hash) => {
  console.log("Password:", password);
  console.log("Hash:   ", hash);
});
