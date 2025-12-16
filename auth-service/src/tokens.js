import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { config } from './config.js';

export function signAccessToken(user) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenExpires });
}

export function signRefreshToken(user) {
  const jti = randomUUID();
  const payload = { sub: user.id, jti };
  return {
    token: jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenExpires }),
    jti
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

export async function hashToken(token) {
  return argon2.hash(token);
}

export async function verifyHashedToken(token, hash) {
  return argon2.verify(hash, token);
}
