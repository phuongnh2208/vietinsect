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

module.exports = { validateLogin };
