import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.AUTH_PORT || '4000', 10),
  dbUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh',
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || '7d',
  cookieDomain: process.env.COOKIE_DOMAIN || 'localhost',
  secureCookies: String(process.env.SECURE_COOKIES || 'true') === 'true',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'https://localhost:4173',
  accountLockThreshold: parseInt(process.env.ACCOUNT_LOCK_THRESHOLD || '5', 10),
  accountLockMs: parseInt(process.env.ACCOUNT_LOCK_MS || '900000', 10)
};

if (!config.dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
