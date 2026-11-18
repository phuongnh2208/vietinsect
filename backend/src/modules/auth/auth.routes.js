const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { requireAdmin } = require("../../middleware/auth.middleware");
const { authRateLimiter } = require("../../middleware/rateLimiter");
const { validateLogin, validateChangePassword } = require("./auth.validator");

router.post("/login", authRateLimiter, validateLogin, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/change-password", authRateLimiter, requireAdmin, validateChangePassword, authController.changePassword);

module.exports = router;
