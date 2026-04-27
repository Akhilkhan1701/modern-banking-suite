const {Router}=require("express")
const authMiddleware=require("../middleware/auth.middleware")
const transactionController=require("../controllers/transaction.controller")
const { validate } = require("../middleware/validate.middleware");
const { createTransactionSchema, initialFundsSchema, myTransactionsSchema } = require("../validation/schemas");



const transactionRoutes=Router();

transactionRoutes.post("/",authMiddleware.authMiddleware,validate(createTransactionSchema),transactionController.transferFundsController)

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemMiddleware,validate(initialFundsSchema),transactionController.systemInitialFundsController)
transactionRoutes.get("/me",authMiddleware.authMiddleware,validate(myTransactionsSchema),transactionController.getMyTransactionsController)


module.exports= transactionRoutes