#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const knex = require("../src/config/knex");

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: node backend/scripts/unlock-admin.js <username>");
    process.exit(1);
  }

  const user = await knex("admin_users").where("username", username).first();
  if (!user) {
    console.error(`Không tìm thấy tài khoản quản trị: ${username}`);
    await knex.destroy();
    process.exit(1);
  }

  await knex("admin_users").where("admin_id", user.admin_id).update({
    failed_login_attempts: 0,
    locked_until: null,
  });

  console.log(`Đã mở khóa thành công tài khoản quản trị: ${username} (admin_id=${user.admin_id})`);
  await knex.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
