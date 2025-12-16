import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.API_PORT || '5000', 10),
  dbUrl: process.env.DATABASE_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET_FALLBACK || 'dev_access'
};

if (!config.dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
