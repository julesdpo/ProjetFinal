import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import argon2 from 'argon2';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import { config } from './config.js';
import { query } from './db.js';
import { logAction } from './audit.js';
import { registerSchema, loginSchema, userStatusSchema } from './validation.js';
import { signAccessToken, signRefreshToken, verifyHashedToken, hashToken, verifyRefreshToken } from './tokens.js';
import { requireAuth, requireAdmin } from './middleware.js';

const app = express();

const corsOptions = {
  origin: config.frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
};

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", corsOptions.origin],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json({
  verify: (req, res, buf) => {
    // Log first bytes of raw body to help debug malformed payloads
    req.rawBody = buf.toString();
    if (req.path === '/register' || req.path === '/login') {
      console.log(`[raw-body ${req.path}]`, req.rawBody.slice(0, 200));
    }
  }
}));
app.use(cookieParser());
app.use(morgan('combined'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Try again later.'
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

function msFromHuman(duration) {
  const map = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  const match = /^([0-9]+)([mhd])$/.exec(duration);
  if (!match) return 0;
  return parseInt(match[1], 10) * map[match[2]];
}

function setAuthCookies(res, accessToken, refreshToken) {
  const common = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'Strict',
    domain: config.cookieDomain,
    path: '/',
  };
  res.cookie('sd_access', accessToken, { ...common, maxAge: msFromHuman(config.accessTokenExpires) || 15 * 60 * 1000 });
  res.cookie('sd_refresh', refreshToken, { ...common, maxAge: msFromHuman(config.refreshTokenExpires) || 7 * 24 * 60 * 60 * 1000 });
}

async function storeRefreshToken(userId, token, jti, expiresAt, userAgent, ip) {
  const tokenHash = await hashToken(token);
  await query(
    'INSERT INTO refresh_tokens(user_id, token_hash, expires_at, user_agent, ip_address, id) VALUES($1,$2,$3,$4,$5,$6)',
    [userId, tokenHash, expiresAt, userAgent || 'unknown', ip || 'unknown', jti]
  );
}

async function revokeRefreshToken(jti) {
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1', [jti]);
}

app.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
    const { email, password } = parsed.data;
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }
    const passwordHash = await argon2.hash(password);
    const result = await query('INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING id, email, role, is_active', [email, passwordHash]);
    await logAction(result.rows[0].id, 'register', { email });
    return res.status(201).json({ id: result.rows[0].id, email, role: 'USER' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
    const { email, password } = parsed.data;
    const userRes = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (userRes.rowCount === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = userRes.rows[0];
    if (!user.is_active) return res.status(403).json({ message: 'Account disabled' });
    if (user.lock_until && dayjs().isBefore(dayjs(user.lock_until))) {
      return res.status(423).json({ message: 'Account locked. Try later.' });
    }
    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      const attempts = user.failed_login_attempts + 1;
      let lockUntil = null;
      if (attempts >= config.accountLockThreshold) {
        lockUntil = dayjs().add(config.accountLockMs, 'millisecond').toDate();
      }
      await query('UPDATE users SET failed_login_attempts=$1, lock_until=$2 WHERE id=$3', [attempts, lockUntil, user.id]);
      await logAction(user.id, 'login_failed', { email, attempts });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    await query('UPDATE users SET failed_login_attempts=0, lock_until=NULL WHERE id=$1', [user.id]);
    const access = signAccessToken(user);
    const { token: refresh, jti } = signRefreshToken(user);
    const refreshExp = dayjs().add(msFromHuman(config.refreshTokenExpires) || 7 * 24 * 60 * 60 * 1000, 'millisecond').toDate();
    await storeRefreshToken(user.id, refresh, jti, refreshExp, req.headers['user-agent'], req.ip);
    setAuthCookies(res, access, refresh);
    await logAction(user.id, 'login_success', { ip: req.ip });
    return res.json({ accessToken: access, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/refresh', async (req, res) => {
  const token = req.cookies.sd_refresh;
  if (!token) return res.status(401).json({ message: 'Missing refresh token' });
  try {
    const decoded = verifyRefreshToken(token);
    const dbToken = await query('SELECT * FROM refresh_tokens WHERE id=$1', [decoded.jti]);
    if (dbToken.rowCount === 0) return res.status(401).json({ message: 'Invalid refresh token' });
    const stored = dbToken.rows[0];
    if (stored.revoked || dayjs(stored.expires_at).isBefore(dayjs())) {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    const match = await verifyHashedToken(token, stored.token_hash).catch(() => false);
    if (!match) return res.status(401).json({ message: 'Invalid refresh token' });
    const userRes = await query('SELECT * FROM users WHERE id=$1', [decoded.sub]);
    if (userRes.rowCount === 0 || !userRes.rows[0].is_active) return res.status(403).json({ message: 'User disabled' });
    const user = userRes.rows[0];
    await revokeRefreshToken(decoded.jti);
    const access = signAccessToken(user);
    const { token: newRefresh, jti } = signRefreshToken(user);
    const refreshExp = dayjs().add(msFromHuman(config.refreshTokenExpires) || 7 * 24 * 60 * 60 * 1000, 'millisecond').toDate();
    await storeRefreshToken(user.id, newRefresh, jti, refreshExp, req.headers['user-agent'], req.ip);
    setAuthCookies(res, access, newRefresh);
    await logAction(user.id, 'refresh_rotated', { old: decoded.jti, new: jti });
    return res.json({ message: 'refreshed' });
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

app.post('/logout', async (req, res) => {
  const token = req.cookies.sd_refresh;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await revokeRefreshToken(decoded.jti);
      await logAction(decoded.sub, 'logout', {});
    } catch (err) {
      console.error('logout token parse', err.message);
    }
  }
  res.clearCookie('sd_access');
  res.clearCookie('sd_refresh');
  return res.json({ message: 'logged out' });
});

app.get('/me', requireAuth, async (req, res) => {
  try {
    const userRes = await query('SELECT id, email, role, is_active FROM users WHERE id=$1', [req.user.sub]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'Not found' });
    return res.json(userRes.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await query('SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
  return res.json(users.rows);
});

app.patch('/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  await query('UPDATE users SET is_active=$1 WHERE id=$2', [parsed.data.is_active, req.params.id]);
  await logAction(req.user.sub, 'user_status_change', { target: req.params.id, active: parsed.data.is_active });
  return res.json({ message: 'updated' });
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(config.port, () => {
  console.log(`auth-service listening on ${config.port}`);
});
