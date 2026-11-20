const Joi = require("joi");

const loginSchema = Joi.object({
  username: Joi.string().trim().required().messages({
    "string.empty": "Tên đăng nhập không được để trống",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Mật khẩu không được để trống",
  }),
});

function validateLogin(req, res, next) {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }
  next();
}

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Vui lòng nhập mật khẩu hiện tại",
  }),
  newPassword: Joi.string()
    .min(12)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/)
    .required()
    .messages({
      "string.min": "Mật khẩu mới phải có tối thiểu 12 ký tự (SRS §5.2)",
      "string.pattern.base":
        "Mật khẩu mới phải gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (SRS §5.2)",
      "string.empty": "Vui lòng nhập mật khẩu mới",
    }),
});

function validateChangePassword(req, res, next) {
  const { error } = changePasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.details[0].message,
    });
  }
  next();
}

module.exports = { validateLogin, validateChangePassword };
