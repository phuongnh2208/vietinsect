const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { validateLogin } = require("./auth.validator");

router.post("/login", validateLogin, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

module.exports = router;
