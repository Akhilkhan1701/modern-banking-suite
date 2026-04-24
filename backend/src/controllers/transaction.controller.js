/**
 * Transaction Controller
 * Handles money transfers, account minting (initial deposit), and transaction history.
 */
const mongoose = require("mongoose");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.models");
const emailService = require("../services/email.services");
const { writeAudit } = require("../services/audit.service");
const crypto = require("crypto");

/**
 * Generates a unique key for transaction idempotency to prevent duplicate processing.
 */
function generateIdempotencyKey(prefix = "TXN") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * Mints (deposits) money into a specific account. 
 * Used for initial balance or system adjustments.
 */
async function mintToAccount({ accountId, amount, idempotencyKey }) {
  const session = await mongoose.startSession();
  let transactionDoc;

  try {
    await session.withTransaction(async () => {
      // 1. Create a pending transaction record
      const created = await transactionModel.create(
        [
          {
            fromAccount: accountId,
            toAccount: accountId,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        { session },
      );
      transactionDoc = created[0];

      // 2. Create a ledger entry for the credit
      await ledgerModel.create(
        [
          {
            account: accountId,
            amount,
            transaction: transactionDoc._id,
            type: "CREDIT",
          },
        ],
        { session },
      );

      // 3. Update account balance (note: balance field is for caching/quick access)
      await accountModel.updateOne(
        { _id: accountId },
        { $inc: { balance: Number(amount) } },
        { session },
      );

      // 4. Mark transaction as completed
      transactionDoc.status = "COMPLETED";
      await transactionDoc.save({ session });
    });

    return transactionDoc;
  } finally {
    await session.endSession();
  }
}

/**
 * Helper to check if a transaction with the same idempotency key already exists.
 */
async function getExistingTransaction(idempotencyKey) {
  if (!idempotencyKey) return null;
  return transactionModel.findOne({ idempotencyKey });
}

/**
 * Handles the response for an existing transaction to maintain idempotency.
 */
function handleExistingTransaction(existingTransaction, res) {
  if (!existingTransaction) return false;

  if (existingTransaction.status === "COMPLETED") {
    res.status(200).json({
      message: "Transaction already completed",
      transaction: existingTransaction,
    });
    return true;
  }

  if (existingTransaction.status === "PENDING") {
    res.status(200).json({ message: "Transaction is already in progress" });
    return true;
  }

  if (existingTransaction.status === "FAILED") {
    res.status(500).json({
      message: "Previous transaction attempt failed. Please try again",
    });
    return true;
  }

  if (existingTransaction.status === "CANCELLED") {
    res.status(400).json({
      message: "Previous transaction attempt was cancelled. Please try again",
    });
    return true;
  }

  return false;
}

async function runTransfer({ fromAccount, toAccount, amount, idempotencyKey }) {
  const session = await mongoose.startSession();
  let transactionDoc;

  try {
    await session.withTransaction(async () => {
      const created = await transactionModel.create(
        [
          {
            fromAccount: fromAccount._id,
            toAccount: toAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING",
          },
        ],
        { session },
      );
      transactionDoc = created[0];

      await ledgerModel.create(
        [
          {
            account: fromAccount._id,
            amount,
            transaction: transactionDoc._id,
            type: "DEBIT",
          },
        ],
        { session },
      );

      await ledgerModel.create(
        [
          {
            account: toAccount._id,
            amount,
            transaction: transactionDoc._id,
            type: "CREDIT",
          },
        ],
        { session },
      );

      await accountModel.updateOne(
        { _id: fromAccount._id },
        { $inc: { balance: -Number(amount) } },
        { session },
      );
      await accountModel.updateOne(
        { _id: toAccount._id },
        { $inc: { balance: Number(amount) } },
        { session },
      );

      transactionDoc.status = "COMPLETED";
      await transactionDoc.save({ session });
    });

    return transactionDoc;
  } finally {
    await session.endSession();
  }
}

async function createTransaction(req, res) {
  try {
    const { fromAccount, toAccount, amount, pin } = req.body;
    const idempotencyKey = req.body.idempotencyKey || generateIdempotencyKey("TXN");

    if (!fromAccount || !toAccount || !amount || !pin) {
      return res.status(400).json({
        message: "fromAccount, toAccount, amount and pin are required",
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const existingTransaction = await getExistingTransaction(idempotencyKey);
    if (handleExistingTransaction(existingTransaction, res)) {
      return;
    }

    const userWithPin = await userModel.findById(req.user._id).select("+transactionPin");
    const isPinValid = await userWithPin.compareTransactionPin(pin);
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid transaction PIN" });
    }

    const fromUserAccount = await accountModel.findOne({
      _id: fromAccount,
      user: req.user._id,
    });
    const toUserAccount = await accountModel.findOne({ _id: toAccount });

    if (!fromUserAccount || !toUserAccount) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (fromUserAccount.status !== "Active" || toUserAccount.status !== "Active") {
      return res.status(400).json({
        message: "Both from and to accounts must be active for a transaction",
      });
    }

    const balance = await fromUserAccount.getBalance();
    if (balance < Number(amount)) {
      return res.status(400).json({
        message: `Insufficient funds. Current balance is ${balance}`,
      });
    }

    const transactionDoc = await runTransfer({
      fromAccount: fromUserAccount,
      toAccount: toUserAccount,
      amount: Number(amount),
      idempotencyKey,
    });

    emailService
      .sendTransactionEmail(req.user.email, req.user.name, Number(amount), "DEBIT")
      .catch(() => {});

    return res.status(201).json({
      message: "Transaction completed successfully",
      transaction: transactionDoc,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An error occurred while processing the transaction",
    });
  }
}

async function createInitialFundsTransaction(req, res) {
  try {
    const { toAccount, amount } = req.body;
    const idempotencyKey = req.body.idempotencyKey || generateIdempotencyKey("ADMIN_FUND");
    if (!toAccount || !amount) {
      return res.status(400).json({
        message: "toAccount and amount are required",
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const existingTransaction = await getExistingTransaction(idempotencyKey);
    if (handleExistingTransaction(existingTransaction, res)) {
      return;
    }

    const toUserAccount = await accountModel.findOne({ _id: toAccount });
    if (!toUserAccount) {
      return res.status(404).json({ message: "To account not found" });
    }

    const fromUserAccount = await accountModel
      .findOne({
        systemUser: true,
        user: req.user._id,
      })
      .select("+systemUser");

    if (!fromUserAccount) {
      return res.status(400).json({ message: "System account not found for the user" });
    }

    if (fromUserAccount.status !== "Active" || toUserAccount.status !== "Active") {
      return res.status(400).json({
        message: "Both from and to accounts must be active for a transaction",
      });
    }

    const balance = await fromUserAccount.getBalance();
    if (balance < Number(amount)) {
      const shortage = Number(amount) - balance;
      await mintToAccount({
        accountId: fromUserAccount._id,
        amount: shortage,
        idempotencyKey: `SYSTEM_TOPUP_${idempotencyKey}`,
      });
    }

    const transactionDoc = await runTransfer({
      fromAccount: fromUserAccount,
      toAccount: toUserAccount,
      amount: Number(amount),
      idempotencyKey,
    });

    writeAudit(req, {
      action: "ADMIN_FUNDED_ACCOUNT",
      targetType: "account",
      targetId: toUserAccount._id,
      metadata: { amount: Number(amount), idempotencyKey },
    }).catch(() => {});

    emailService
      .sendTransactionEmail(req.user.email, req.user.name, Number(amount), "INITIAL_FUNDS")
      .catch(() => {});

    return res.status(201).json({
      message: "Initial funds transaction completed successfully",
      transaction: transactionDoc,
    });
  } catch (error) {
    return res.status(500).json({
      message: "An error occurred while processing the transaction",
    });
  }
}

async function getMyTransactions(req, res) {
  try {
    const userAccounts = await accountModel.find({ user: req.user._id }).select("_id");
    const accountIds = userAccounts.map((account) => account._id);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const transactions = await transactionModel
      .find({
        $or: [{ fromAccount: { $in: accountIds } }, { toAccount: { $in: accountIds } }],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({ page, limit, transactions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
  getMyTransactions,
};
