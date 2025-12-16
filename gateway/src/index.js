import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';

const app = express();
app.set('trust proxy', 1);

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
      connectSrc: ["'self'", config.frontendOrigin],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 15552000 },
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('combined'));

const shouldSkipRateLimit = () => process.env.DISABLE_RATE_LIMIT === 'true';
const limiterConfig = {
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.path.split('/')[1] || 'root'}`,
  skip: shouldSkipRateLimit
};

if (shouldSkipRateLimit()) {
  console.warn('Rate limiting disabled (dev mode).');
}

// Apply rate limit separately on /auth and /api to avoid sharing a single bucket.
app.use('/auth', rateLimit(limiterConfig));
app.use('/api', rateLimit(limiterConfig));

// Promote HttpOnly access token cookie to Authorization header for downstream services.
app.use((req, res, next) => {
  const accessCookie = req.cookies?.sd_access;
  if (accessCookie && req.path.startsWith('/api')) {
    req.headers.authorization = `Bearer ${accessCookie}`;
  }
  return next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const proxyCommon = {
  changeOrigin: true,
  logLevel: 'warn',
  secure: false,
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-forwarded-for', req.ip);
    proxyReq.setHeader('x-forwarded-proto', 'https');
  },
  onError: (err, req, res) => {
    console.error('Proxy error', err.message);
    res.status(502).json({ message: 'Bad gateway' });
  }
};

function fixRequestBody(proxyReq, req) {
  if (!req.body || !Object.keys(req.body).length) return;
  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

app.use('/auth', createProxyMiddleware({
  ...proxyCommon,
  target: config.authServiceUrl,
  pathRewrite: { '^/auth': '' },
  onProxyReq: (proxyReq, req, res) => {
    proxyCommon.onProxyReq(proxyReq, req, res);
    fixRequestBody(proxyReq, req);
  }
}));

app.use('/api', createProxyMiddleware({
  ...proxyCommon,
  target: config.apiServiceUrl,
  pathRewrite: { '^/api': '' },
  onProxyReq: (proxyReq, req, res) => {
    proxyCommon.onProxyReq(proxyReq, req, res);
    fixRequestBody(proxyReq, req);
  }
}));

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

const httpsOptions = fs.existsSync(config.tlsCertPath) && fs.existsSync(config.tlsKeyPath)
  ? { cert: fs.readFileSync(config.tlsCertPath), key: fs.readFileSync(config.tlsKeyPath) }
  : null;

if (httpsOptions) {
  https.createServer(httpsOptions, app).listen(config.port, () => {
    console.log(`gateway listening on https:${config.port}`);
  });
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `${config.frontendOrigin}` });
    res.end();
  }).listen(config.httpPort, () => {
    console.log(`gateway http redirect on ${config.httpPort}`);
  });
} else {
  console.warn('TLS certs not found, serving plain HTTP on fallback port (dev only).');
  http.createServer(app).listen(config.httpPort, () => {
    console.log(`gateway http fallback on ${config.httpPort}`);
  });
}
