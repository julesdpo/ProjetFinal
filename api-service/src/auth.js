import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { query } from './db.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtAccessSecret);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  return next();
}

export async function ensureActiveUser(req, res, next) {
  try {
    const result = await query('SELECT is_active FROM users WHERE id=$1', [req.user.sub]);
    if (result.rowCount === 0 || !result.rows[0].is_active) {
      return res.status(403).json({ message: 'Account disabled' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}
