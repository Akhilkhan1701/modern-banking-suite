/**
 * Express Application Configuration
 * Sets up middleware, routes, and security features.
 */
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const crypto = require("crypto");

const { logger } = require("./logger");

const authRouter = require("./routes/auth.routes");
const accountRouter = require("./routes/account.routes");
const transactionRoutes = require("./routes/transaction.routes");

const app = express();

// Required for rate limiting behind proxies (e.g., Heroku, Nginx)
app.set("trust proxy", 1);

// HTTP Logging with unique request IDs
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers["x-request-id"];
      const id = typeof existing === "string" && existing.length ? existing : crypto.randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
  }),
);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Gzip Compression
app.use(compression());

// CORS Setup
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Body Parsers
app.use(express.json());
app.use(cookieParser());

// Rate Limiting for Authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Rate Limiting for Transactions
const txnLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// API Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/transactions", txnLimiter, transactionRoutes);

// Frontend Integration
// Serve static files from the React app in production
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDistPath));

// Client-side routing fallback
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  if (req.method !== "GET") {
    return next();
  }
  return res.sendFile(path.join(frontendDistPath, "index.html"), (error) => {
    if (error) {
      next();
    }
  });
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "Route not found" });
  }
  return res.status(404).send("Not found");
});

module.exports = app;