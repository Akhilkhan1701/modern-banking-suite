const accountModel = require("../models/account.model");
const { writeAudit } = require("../services/audit.service");
const userModel = require("../models/user.models");

async function createAccountController(req, res) {
  try {
    const account = await accountModel.create({
      user: req.user._id,
      status: "PENDING_APPROVAL",
    });
    return res.status(201).json({
      message: "Account request submitted for admin approval",
      account,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create account request" });
  }
}

async function getUserAccountsController(req, res) {
  try {
    const accounts = await accountModel.find({ user: req.user._id }).sort({ createdAt: -1 });
    const safeAccounts = accounts.map((account) => {
      const obj = account.toObject();
      delete obj.balance;
      return obj;
    });
    return res.status(200).json({ accounts: safeAccounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch accounts" });
  }
}

async function unlockAccountsController(req, res) {
  try {
    const { pin } = req.body;
    const userWithPin = await userModel.findById(req.user._id).select("+transactionPin");
    const ok = await userWithPin.compareTransactionPin(pin);
    if (!ok) {
      return res.status(401).json({ message: "Invalid transaction PIN" });
    }

    const accounts = await accountModel.find({ user: req.user._id }).sort({ createdAt: -1 });
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => ({
        ...account.toObject(),
        balance: await account.getBalance(),
      })),
    );

    return res.status(200).json({ accounts: accountsWithBalance });
  } catch (error) {
    return res.status(500).json({ message: "Failed to unlock accounts" });
  }
}

async function getAccountBalanceController(req, res) {
  try {
    const account = await accountModel.findOne({
      _id: req.params.accountId,
      user: req.user._id,
    });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "Active") {
      return res.status(400).json({ message: "Account must be active to check balance" });
    }
    return res.status(200).json({
      accountId: account._id,
      balance: await account.getBalance(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch account balance" });
  }
}

async function getPendingAccountsController(req, res) {
  try {
    const accounts = await accountModel
      .find({ status: "PENDING_APPROVAL" })
      .populate("user", "name email")
      .sort({ createdAt: 1 });
    return res.status(200).json({ accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch pending accounts" });
  }
}

async function approveAccountController(req, res) {
  try {
    const account = await accountModel.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ message: "Only pending accounts can be approved" });
    }
    account.status = "Active";
    account.approvalNote = req.body.note || "";
    account.approvedBy = req.user._id;
    await account.save();

    writeAudit(req, {
      action: "ACCOUNT_APPROVED",
      targetType: "account",
      targetId: account._id,
      metadata: { note: account.approvalNote },
    }).catch(() => {});
    return res.status(200).json({ message: "Account approved", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to approve account" });
  }
}

async function rejectAccountController(req, res) {
  try {
    const account = await accountModel.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ message: "Only pending accounts can be rejected" });
    }
    account.status = "REJECTED";
    account.approvalNote = req.body.note || "";
    account.approvedBy = req.user._id;
    await account.save();

    writeAudit(req, {
      action: "ACCOUNT_REJECTED",
      targetType: "account",
      targetId: account._id,
      metadata: { note: account.approvalNote },
    }).catch(() => {});
    return res.status(200).json({ message: "Account rejected", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reject account" });
  }
}

async function getAllAccountsAdminController(req, res) {
  try {
    const accounts = await accountModel
      .find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => ({
        ...account.toObject(),
        balance: await account.getBalance(),
      })),
    );

    return res.status(200).json({ accounts: accountsWithBalance });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch accounts" });
  }
}

async function revokeAccountAdminController(req, res) {
  try {
    const account = await accountModel.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status === "CLOSED") {
      return res.status(400).json({ message: "Closed accounts cannot be revoked" });
    }
    if (account.status === "FROZEN") {
      return res.status(200).json({ message: "Account already revoked", account });
    }

    account.status = "FROZEN";
    account.approvalNote = req.body?.note || "Revoked by admin";
    account.approvedBy = req.user._id;
    await account.save();

    writeAudit(req, {
      action: "ACCOUNT_REVOKED",
      targetType: "account",
      targetId: account._id,
      metadata: { note: account.approvalNote },
    }).catch(() => {});

    return res.status(200).json({ message: "Account revoked", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to revoke account" });
  }
}

async function unrevokeAccountAdminController(req, res) {
  try {
    const account = await accountModel.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (account.status !== "FROZEN") {
      return res.status(400).json({ message: "Only revoked (frozen) accounts can be restored" });
    }

    account.status = "Active";
    account.approvalNote = req.body?.note || "Restored by admin";
    account.approvedBy = req.user._id;
    await account.save();

    writeAudit(req, {
      action: "ACCOUNT_RESTORED",
      targetType: "account",
      targetId: account._id,
      metadata: { note: account.approvalNote },
    }).catch(() => {});

    return res.status(200).json({ message: "Account restored", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to restore account" });
  }
}

module.exports = {
  createAccountController,
  getUserAccountsController,
  unlockAccountsController,
  getAccountBalanceController,
  getPendingAccountsController,
  approveAccountController,
  rejectAccountController,
  getAllAccountsAdminController,
  revokeAccountAdminController,
  unrevokeAccountAdminController,
};
