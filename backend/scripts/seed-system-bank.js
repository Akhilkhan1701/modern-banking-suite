require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userModel = require("../src/models/user.models");
const accountModel = require("../src/models/account.model");
const transactionModel = require("../src/models/transaction.model");
const ledgerModel = require("../src/models/ledger.model");

const email =
  process.env.SYSTEM_BANK_EMAIL || "system-reserve@bank.local";
const password =
  process.env.SYSTEM_BANK_PASSWORD || "ChangeMe_System123!";
const pin = process.env.SYSTEM_BANK_PIN || "1111";
const name = "System Reserve";
const initialBalance = Number(process.env.SYSTEM_BANK_INITIAL_BALANCE || 1000000000);

async function ensureSystemCredentials(user) {
  const updates = {
    password: await bcrypt.hash(password, 10),
    transactionPin: await bcrypt.hash(pin, 10),
  };

  await mongoose.connection.collection("users").updateOne({ _id: user._id }, { $set: updates });
}

async function mintReserveBalance(accountId, amount) {
  if (!amount || amount <= 0) {
    return;
  }

  const idempotencyKey = `SEED_SYSTEM_BALANCE_${accountId}_${amount}`;
  const existing = await transactionModel.findOne({ idempotencyKey });
  if (existing) {
    return;
  }

  const [tx] = await transactionModel.create([
    {
      fromAccount: accountId,
      toAccount: accountId,
      amount,
      idempotencyKey,
      status: "COMPLETED",
    },
  ]);

  await ledgerModel.create([
    {
      account: accountId,
      amount,
      transaction: tx._id,
      type: "CREDIT",
    },
  ]);

  await accountModel.updateOne({ _id: accountId }, { $inc: { balance: Number(amount) } });
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("Missing MONGO_URI");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  let user = await userModel.findOne({ email }).select("+systemUser");

  if (!user) {
    user = await userModel.create({
      email,
      password,
      transactionPin: pin,
      name,
      systemUser: true,
    });
    console.log("Created system user:", email);
  } else if (!user.systemUser) {
    await mongoose.connection.collection("users").updateOne(
      { _id: user._id },
      { $set: { systemUser: true } }
    );
    user = await userModel.findById(user._id).select("+systemUser");
    console.log("Promoted existing user to system user:", email);
  } else {
    console.log("System user already exists:", email);
  }

  await ensureSystemCredentials(user);

  let reserveAccount = await accountModel
    .findOne({ user: user._id, systemUser: true })
    .select("+systemUser");

  if (!reserveAccount) {
    const anyAccount = await accountModel.findOne({ user: user._id }).select("+systemUser");
    if (anyAccount) {
      await mongoose.connection.collection("accounts").updateOne(
        { _id: anyAccount._id },
        { $set: { systemUser: true, status: "Active" } }
      );
      console.log("Marked existing account as system reserve:", anyAccount._id);
    } else {
      reserveAccount = await accountModel.create({
        user: user._id,
        systemUser: true,
        status: "Active",
      });
      console.log("Created system reserve account:", reserveAccount._id);
    }
  } else {
    console.log("System reserve account OK:", reserveAccount._id);
  }

  if (!reserveAccount) {
    reserveAccount = await accountModel
      .findOne({ user: user._id, systemUser: true })
      .select("+systemUser");
  }
  if (reserveAccount.status !== "Active") {
    reserveAccount.status = "Active";
    await reserveAccount.save();
  }
  await mintReserveBalance(reserveAccount._id, initialBalance);
  console.log("System reserve account funded with:", initialBalance);

  console.log("\nLogin with this user (POST /api/auth/login) and use the returned token when calling initial-funds.");
  console.log("Email:", email);
  if (!process.env.SYSTEM_BANK_PASSWORD) {
    console.log("Password (default):", password);
  }
  if (!process.env.SYSTEM_BANK_PIN) {
    console.log("PIN (default):", pin);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
