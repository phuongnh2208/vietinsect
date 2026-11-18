const authService = require("./auth.service");
const { logAudit } = require("../system/system.service");

// SRS §3.4: refreshToken lưu HttpOnly; Secure; SameSite=Strict; Path=/api/auth.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
  path: "/api/auth",
};

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    // Set refreshToken vào HttpOnly cookie — JS không đọc được
    res.cookie("vietinsect_refresh", result.refreshTokenRaw, REFRESH_COOKIE_OPTIONS);

    await logAudit({
      adminId: result.user.adminId,
      actionType: "LOGIN",
      targetTable: "admin_users",
      targetId: result.user.adminId,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      details: { username: result.user.username },
    });

    // Chỉ trả accessToken + user ra body
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshTokenRaw = req.cookies?.vietinsect_refresh;
    if (!refreshTokenRaw) {
      return res.status(401).json({
        success: false,
        code: "AUTH.TOKEN_MISSING",
        message: "Thiếu refresh token",
      });
    }
    const result = await authService.refresh(refreshTokenRaw);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const refreshTokenRaw = req.cookies?.vietinsect_refresh;
    await authService.logout(refreshTokenRaw);
    res.clearCookie("vietinsect_refresh", { path: "/api/auth" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.admin.adminId, currentPassword, newPassword);
    res.clearCookie("vietinsect_refresh", { path: "/api/auth" });

    await logAudit({
      adminId: req.admin.adminId,
      actionType: "CHANGE_PASSWORD",
      targetTable: "admin_users",
      targetId: req.admin.adminId,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      details: { revokedAllSessions: true },
    });

    res.json({ success: true, message: "Đổi mật khẩu thành công, vui lòng đăng nhập lại." });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, changePassword };
