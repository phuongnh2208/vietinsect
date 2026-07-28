const authService = require("./auth.service");

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
