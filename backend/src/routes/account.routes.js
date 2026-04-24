const express=require("express")
const authMiddleware=require("../middleware/auth.middleware")
const accountController= require("../controllers/account.controller.js")
const { validate } = require("../middleware/validate.middleware");
const { createAccountSchema, approveRejectSchema, unlockAccountsSchema } = require("../validation/schemas");


const router=express.Router()

router.post("/",authMiddleware.authMiddleware,validate(createAccountSchema),accountController.createAccountController)


router.get("/",authMiddleware.authMiddleware,accountController.getUserAccountsController)
router.post("/unlock",authMiddleware.authMiddleware,validate(unlockAccountsSchema),accountController.unlockAccountsController)

router.get("/balance/:accountId",authMiddleware.authMiddleware,accountController.getAccountBalanceController)
router.get("/admin/pending",authMiddleware.authSystemMiddleware,accountController.getPendingAccountsController)
router.get("/admin/all",authMiddleware.authSystemMiddleware,accountController.getAllAccountsAdminController)
router.post("/admin/approve/:accountId",authMiddleware.authSystemMiddleware,validate(approveRejectSchema),accountController.approveAccountController)
router.post("/admin/reject/:accountId",authMiddleware.authSystemMiddleware,validate(approveRejectSchema),accountController.rejectAccountController)
router.post("/admin/revoke/:accountId",authMiddleware.authSystemMiddleware,validate(approveRejectSchema),accountController.revokeAccountAdminController)
router.post("/admin/unrevoke/:accountId",authMiddleware.authSystemMiddleware,validate(approveRejectSchema),accountController.unrevokeAccountAdminController)


module.exports=router