const { z } = require("zod");

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const createAccountSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const approveRejectSchema = z.object({
  body: z.object({
    note: z.string().max(500).optional(),
  }),
  params: z.object({
    accountId: z.string().min(1),
  }),
  query: z.object({}).optional(),
});

const unlockAccountsSchema = z.object({
  body: z.object({
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const createTransactionSchema = z.object({
  body: z.object({
    fromAccount: z.string().min(1),
    toAccount: z.string().min(1),
    amount: z.number().positive(),
    idempotencyKey: z.string().min(1).optional(),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const initialFundsSchema = z.object({
  body: z.object({
    toAccount: z.string().min(1),
    amount: z.number().positive(),
    idempotencyKey: z.string().min(1).optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const myTransactionsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  createAccountSchema,
  approveRejectSchema,
  unlockAccountsSchema,
  createTransactionSchema,
  initialFundsSchema,
  myTransactionsSchema,
};

