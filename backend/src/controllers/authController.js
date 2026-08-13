import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      id: userId.toString()
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};

const normalizeEmail = (email) => {
  if (
    typeof email !== "string"
  ) {
    return "";
  }

  return email
    .trim()
    .toLowerCase();
};

const register = async (
  req,
  res
) => {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const password =
      typeof req.body?.password ===
      "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters"
      });
    }

    if (email.length > 254) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address"
      });
    }

    const existingUser =
      await User.findOne({
        email
      }).lean();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await User.create({
        email,
        password: hashedPassword
      });

    return res.status(201).json({
      success: true,

      token: generateToken(
        user._id
      ),

      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(
      "[Auth] Registration error:",
      error
    );

    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
};

const login = async (
  req,
  res
) => {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const password =
      typeof req.body?.password ===
      "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required"
      });
    }

    const user =
      await User.findOne({
        email
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password"
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password"
      });
    }

    return res.json({
      success: true,

      token: generateToken(
        user._id
      ),

      user: {
        id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(
      "[Auth] Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};

export {
  register,
  login
};