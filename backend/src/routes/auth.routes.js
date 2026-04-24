const express=require('express');
const authController=require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { registerSchema, loginSchema } = require("../validation/schemas");

const router=express.Router();


router.post("/register", validate(registerSchema), authController.userRegisterController)

router.post("/login", validate(loginSchema), authController.userLoginController)
router.post("/logout",authController.userLogoutController)


module.exports=router