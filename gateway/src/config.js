import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.GATEWAY_PORT || '8443', 10),
  httpPort: parseInt(process.env.GATEWAY_HTTP_PORT || '8080', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'https://localhost:4173',
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
  apiServiceUrl: process.env.API_SERVICE_URL || 'http://localhost:5000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  tlsCertPath: process.env.TLS_CERT_PATH || '/certs/dev.cert',
  tlsKeyPath: process.env.TLS_KEY_PATH || '/certs/dev.key'
};
