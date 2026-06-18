import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';
import * as userRepo from '../repositories/user.repository.js';
import * as refreshTokenRepo from '../repositories/refresh-token.repository.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';

// Hash a refresh token using SHA-256 before storing
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate an access token (short-lived)
const generateAccessToken = (user) => {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
};

// Generate a random refresh token and store its hash in DB
const generateRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);

  // Calculate expiry date (7 days default)
  const days = parseInt(env.JWT_REFRESH_EXPIRY) || 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await refreshTokenRepo.create({
    tokenHash,
    userId,
    expiresAt,
  });

  return token;
};

// Register a new user
export const register = async ({ name, email, password, role }) => {
  // Check if email already exists
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  // Create the user
  const user = await userRepo.create({
    name,
    email,
    passwordHash,
    role: role || 'MEMBER',
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

// Login with email and password
export const login = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

// Refresh tokens — rotate (delete old, create new)
export const refresh = async (oldToken) => {
  const tokenHash = hashToken(oldToken);
  const stored = await refreshTokenRepo.findByHash(tokenHash);

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token is expired
  if (new Date() > stored.expiresAt) {
    await refreshTokenRepo.deleteByHash(tokenHash);
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Delete the old token (rotation)
  await refreshTokenRepo.deleteByHash(tokenHash);

  // Get the user
  const user = await userRepo.findById(stored.userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Generate new token pair
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken };
};

// Logout — delete the refresh token
export const logout = async (token) => {
  const tokenHash = hashToken(token);
  try {
    await refreshTokenRepo.deleteByHash(tokenHash);
  } catch (_error) {
    // Token might already be deleted, that's ok
  }
};

// Get user profile by ID
export const getProfile = async (userId) => {
  const user = await userRepo.findByIdSafe(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return user;
};
