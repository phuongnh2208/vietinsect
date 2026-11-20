const authService = require("./auth.service");
const { logAudit } = require("../system/system.service");

// SRS §3.4: refreshToken lưu HttpOnly; Secure (khi production); SameSite=Strict; Path=/api/auth.
function getRefreshCookieOptions(nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
    path: "/api/auth",
  };
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    // Set refreshToken vào HttpOnly cookie — JS không đọc được
    res.cookie("vietinsect_refresh", result.refreshTokenRaw, getRefreshCookieOptions());

    await logAudit({
      adminId: result.user.adminId,
      actionType: "LOGIN",
      targetTable: "admin_users",
      targetId: result.user.adminId,
      ipAddress: req.ip || req.socket?.remoteAddress,
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
    if (result.refreshTokenRaw) {
      res.cookie("vietinsect_refresh", result.refreshTokenRaw, getRefreshCookieOptions());
    }
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

async function logout(req, res, next) {
  try {
    const refreshTokenRaw = req.cookies?.vietinsect_refresh;
    const header = req.headers.authorization || "";
    const accessTokenRaw = header.startsWith("Bearer ") ? header.slice(7) : null;
    const { adminId } = await authService.logout(refreshTokenRaw, accessTokenRaw);
    res.clearCookie("vietinsect_refresh", { path: "/api/auth" });

    await logAudit({
      adminId: adminId || null,
      actionType: "LOGOUT",
      targetTable: "admin_users",
      targetId: adminId || null,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: {},
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await authService.logoutAll(req.admin.adminId);
    res.clearCookie("vietinsect_refresh", { path: "/api/auth" });

    await logAudit({
      adminId: req.admin.adminId,
      actionType: "LOGOUT_ALL",
      targetTable: "admin_users",
      targetId: req.admin.adminId,
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { revokedAllSessions: true },
    });

    res.json({ success: true, message: "Đã đăng xuất khỏi tất cả thiết bị." });
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
      ipAddress: req.ip || req.socket?.remoteAddress,
      details: { revokedAllSessions: true },
    });

    res.json({ success: true, message: "Đổi mật khẩu thành công, vui lòng đăng nhập lại." });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, logoutAll, changePassword, getRefreshCookieOptions };
