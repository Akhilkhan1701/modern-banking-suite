const userModel = require("../models/user.models");
const tokenBlacklistModel = require("../models/blacklist.model");
const jwt = require("jsonwebtoken");

function extractToken(req) {
  return req.cookies.token || req.headers.authorization?.split(" ")[1];
}

async function validateToken(token) {
  const isBlacklisted = await tokenBlacklistModel.findOne({ token });
  if (isBlacklisted) {
    return { error: "Token is blacklisted. Please login again.", status: 401 };
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await userModel.findById(decoded.userId).select("+systemUser");
  if (!user) {
    return { error: "User not found.", status: 401 };
  }
  return { user };
}

async function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const result = await validateToken(token);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }
    req.user = result.user;
    return next();
  } catch (err) {
    return res.status(400).json({ message: "Invalid token." });
  }
}

async function authSystemMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const result = await validateToken(token);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }
    if (!result.user.systemUser) {
      return res.status(403).json({ message: "Access denied. Not a system user." });
    }
    req.user = result.user;
    return next();
  } catch (err) {
    return res.status(400).json({ message: "Unauthorised access. Invalid token." });
  }
}

module.exports = {
  authMiddleware,
  authSystemMiddleware,
};
