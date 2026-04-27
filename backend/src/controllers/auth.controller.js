const userModel = require("../models/user.models");
const tokenBlackListModel = require("../models/blacklist.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.services");

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function userRegisterController(req, res) {
  try {
    const { email, password, name, pin } = req.body;
    
    if (!email || !password || !name || !pin) {
      return res.status(400).json({ message: "email, password, name and pin are required" });
    }
    
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be exactly 4 digits" });
    }

    const isExists = await userModel.findOne({ email });
    if (isExists) {
      return res.status(422).json({
        message: "User already exists",
        status: "failed",
      });
    }

    const user = await userModel.create({ email, password, name, transactionPin: pin });
    
    const token = signToken(user._id);
    setTokenCookie(res, token);

    emailService.sendRegistrationEmail(user.email, user.name).catch(() => {});

    return res.status(201).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        systemUser: false,
        hasPin: true,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
}

async function userLoginController(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await userModel.findOne({ email }).select("+password +systemUser");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id);
    setTokenCookie(res, token);
    
    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        systemUser: user.systemUser || false,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
}

async function userLogoutController(req, res) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (token) {
      await tokenBlackListModel.create({ token });
    }
    res.clearCookie("token");
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed" });
  }
}

module.exports = {
  userRegisterController,
  userLoginController,
  userLogoutController,
};
