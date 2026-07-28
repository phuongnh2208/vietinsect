const AuthError = {
  INVALID_CREDENTIALS: {
    code: "AUTH.INVALID_CREDENTIALS",
    message: "Sai tên đăng nhập hoặc mật khẩu",
    statusCode: 401,
  },
  ACCOUNT_LOCKED: {
    code: "AUTH.ACCOUNT_LOCKED",
    message: "Tài khoản đang bị khóa, vui lòng thử lại sau",
    statusCode: 423,
  },
  TOKEN_EXPIRED: {
    code: "AUTH.TOKEN_EXPIRED",
    message: "Token đã hết hạn",
    statusCode: 401,
  },
  TOKEN_INVALID: {
    code: "AUTH.TOKEN_INVALID",
    message: "Token không hợp lệ",
    statusCode: 401,
  },
  FORBIDDEN: {
    code: "AUTH.FORBIDDEN",
    message: "Bạn không có quyền thực hiện hành động này",
    statusCode: 403,
  },
};

module.exports = AuthError;
