const mongoose = require("mongoose");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.models");
const emailService = require("../services/email.services");
const { writeAudit } = require("../services/audit.service");
const crypto = require("crypto");

function generateIdempotencyKey(prefix = "TXN") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

async function mintToAccount({ accountId, amount, idempotencyKey }) {
  const session = await mongoose.startSession();
  let transactionDoc;

  try {
    await session.withTransaction(async () => {
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

      await accountModel.updateOne(
        { _id: accountId },
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

async function getExistingTransaction(idempotencyKey) {
  if (!idempotencyKey) return null;
  return transactionModel.findOne({ idempotencyKey });
}

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

  return false;
}

async function transferFundsController(req, res) {
  const session = await mongoose.startSession();
  try {
    const { fromAccountId, toAccountId, amount, pin, idempotencyKey } = req.body;

    if (!fromAccountId || !toAccountId || !amount || !pin) {
      return res.status(400).json({ message: "Missing required transfer fields" });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Transfer amount must be positive" });
    }

    const existing = await getExistingTransaction(idempotencyKey);
    if (handleExistingTransaction(existing, res)) return;

    const user = await userModel.findById(req.user._id).select("+transactionPin");
    const isPinValid = await user.compareTransactionPin(pin);
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid transaction PIN" });
    }

    const fromAccount = await accountModel.findOne({ _id: fromAccountId, user: req.user._id });
    if (!fromAccount || fromAccount.status !== "Active") {
      return res.status(400).json({ message: "Source account is not active" });
    }

    const toAccount = await accountModel.findById(toAccountId).populate("user", "email name");
    if (!toAccount || toAccount.status !== "Active") {
      return res.status(400).json({ message: "Destination account is not active" });
    }

    if (fromAccount._id.equals(toAccount._id)) {
      return res.status(400).json({ message: "Cannot transfer to the same account" });
    }

    const currentBalance = await fromAccount.getBalance();
    if (currentBalance < Number(amount)) {
      return res.status(400).json({ message: "Insufficient funds" });
    }

    let transactionDoc;
    await session.withTransaction(async () => {
      const created = await transactionModel.create(
        [
          {
            fromAccount: fromAccountId,
            toAccount: toAccountId,
            amount,
            idempotencyKey: idempotencyKey || generateIdempotencyKey(),
            status: "PENDING",
          },
        ],
        { session },
      );
      transactionDoc = created[0];

      await ledgerModel.create(
        [
          { account: fromAccountId, amount, transaction: transactionDoc._id, type: "DEBIT" },
          { account: toAccountId, amount, transaction: transactionDoc._id, type: "CREDIT" },
        ],
        { session },
      );

      await accountModel.updateOne({ _id: fromAccountId }, { $inc: { balance: -Number(amount) } }, { session });
      await accountModel.updateOne({ _id: toAccountId }, { $inc: { balance: Number(amount) } }, { session });

      transactionDoc.status = "COMPLETED";
      await transactionDoc.save({ session });
    });

    emailService.sendTransactionEmail(req.user.email, req.user.name, {
      type: "DEBIT",
      amount,
      otherAccount: toAccountId,
      transactionId: transactionDoc._id,
    }).catch(() => {});

    emailService.sendTransactionEmail(toAccount.user.email, toAccount.user.name, {
      type: "CREDIT",
      amount,
      otherAccount: fromAccountId,
      transactionId: transactionDoc._id,
    }).catch(() => {});

    await writeAudit(req, {
      action: "TRANSFER_FUNDS",
      targetType: "transaction",
      targetId: transactionDoc._id,
      metadata: { fromAccountId, toAccountId, amount },
    }).catch(() => {});

    return res.status(200).json({ message: "Transfer successful", transaction: transactionDoc });
  } catch (error) {
    return res.status(500).json({ message: "Transfer failed" });
  } finally {
    await session.endSession();
  }
}

async function getMyTransactionsController(req, res) {
  try {
    const userAccounts = await accountModel.find({ user: req.user._id }).select("_id");
    const accountIds = userAccounts.map((a) => a._id);

    const transactions = await transactionModel
      .find({
        $or: [{ fromAccount: { $in: accountIds } }, { toAccount: { $in: accountIds } }],
      })
      .sort({ createdAt: -1 })
      .populate("fromAccount toAccount");

    return res.status(200).json({ transactions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transactions" });
  }
}

async function adminMintFundsController(req, res) {
  try {
    const { accountId, amount, note } = req.body;
    if (!accountId || !amount) {
      return res.status(400).json({ message: "AccountId and amount are required" });
    }

    const account = await accountModel.findById(accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });

    const idempotencyKey = generateIdempotencyKey("ADMIN_MINT");
    const transaction = await mintToAccount({ accountId, amount, idempotencyKey });

    await writeAudit(req, {
      action: "ADMIN_MINT_FUNDS",
      targetType: "account",
      targetId: accountId,
      metadata: { amount, note },
    }).catch(() => {});

    return res.status(200).json({ message: "Funds added successfully", transaction });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add funds" });
  }
}

async function systemInitialFundsController(req, res) {
  try {
    const { accountId, amount } = req.body;
    if (!accountId || !amount) {
      return res.status(400).json({ message: "AccountId and amount are required" });
    }

    const systemUser = await userModel.findOne({ systemUser: true });
    if (!systemUser) return res.status(500).json({ message: "System user not found" });

    const reserveAccount = await accountModel.findOne({ user: systemUser._id });
    if (!reserveAccount) return res.status(500).json({ message: "Reserve account not found" });

    const reserveBalance = await reserveAccount.getBalance();
    if (reserveBalance < Number(amount)) {
      return res.status(400).json({ message: "Insufficient system reserve" });
    }

    const idempotencyKey = generateIdempotencyKey("SYS_INIT");
    
    const session = await mongoose.startSession();
    let transactionDoc;
    try {
      await session.withTransaction(async () => {
        const created = await transactionModel.create(
          [
            {
              fromAccount: reserveAccount._id,
              toAccount: accountId,
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
            { account: reserveAccount._id, amount, transaction: transactionDoc._id, type: "DEBIT" },
            { account: accountId, amount, transaction: transactionDoc._id, type: "CREDIT" },
          ],
          { session },
        );

        await accountModel.updateOne({ _id: reserveAccount._id }, { $inc: { balance: -Number(amount) } }, { session });
        await accountModel.updateOne({ _id: accountId }, { $inc: { balance: Number(amount) } }, { session });

        transactionDoc.status = "COMPLETED";
        await transactionDoc.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({ message: "Initial funds provided", transaction: transactionDoc });
  } catch (error) {
    return res.status(500).json({ message: "Failed to provide initial funds" });
  }
}

module.exports = {
  transferFundsController,
  getMyTransactionsController,
  adminMintFundsController,
  systemInitialFundsController,
};
