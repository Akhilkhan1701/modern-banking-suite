process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../src/app");
const userModel = require("../src/models/user.models");
const accountModel = require("../src/models/account.model");

let mongo;

async function registerAndLoginUser({ email, name, password, pin }) {
  await request(app).post("/api/auth/register").send({ email, name, password, pin }).expect(201);
  const login = await request(app).post("/api/auth/login").send({ email, password }).expect(200);
  return login.body.token;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    instance: { launchTimeout: 60_000 },
  });
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

afterEach(async () => {
  await Promise.all([userModel.deleteMany({}), accountModel.deleteMany({})]);
  await mongoose.connection.db.dropDatabase();
});

test("register requires pin and then login works", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({ email: "a@a.com", name: "A", password: "123456" })
    .expect(400);

  await request(app)
    .post("/api/auth/register")
    .send({ email: "a@a.com", name: "A", password: "123456", pin: "1234" })
    .expect(201);

  await request(app).post("/api/auth/login").send({ email: "a@a.com", password: "123456" }).expect(200);
});

test("user account request is pending and admin can approve", async () => {
  // Create admin directly.
  const admin = await userModel.create({
    email: "admin@bank.com",
    name: "Admin",
    password: "123456",
    transactionPin: "1111",
    systemUser: true,
  });
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@bank.com", password: "123456" })
    .expect(200);
  const adminToken = adminLogin.body.token;

  const userToken = await registerAndLoginUser({
    email: "u@bank.com",
    name: "User",
    password: "123456",
    pin: "2222",
  });

  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${userToken}`)
    .send({})
    .expect(201);
  expect(created.body.account.status).toBe("PENDING_APPROVAL");

  const pending = await request(app)
    .get("/api/accounts/admin/pending")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
  expect(pending.body.accounts.length).toBeGreaterThan(0);

  const accountId = pending.body.accounts[0]._id;
  const approved = await request(app)
    .post(`/api/accounts/admin/approve/${accountId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ note: "ok" })
    .expect(200);
  expect(approved.body.account.status).toBe("Active");
});

