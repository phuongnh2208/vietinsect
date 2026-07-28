const logger = require("../config/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Lỗi hệ thống, vui lòng thử lại sau";

  logger.error(`${req.method} ${req.originalUrl} - [${code}] ${message}`, {
    stack: err.stack,
  });

  res.status(statusCode).json({ success: false, code, message });
}

module.exports = errorHandler;
