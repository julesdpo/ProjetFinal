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

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
});
if (process.env.DISABLE_RATE_LIMIT === 'true') {
  console.warn('Rate limiting disabled (dev mode).');
} else {
  app.use(limiter);
}

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

app.use('/auth', createProxyMiddleware({
  ...proxyCommon,
  target: config.authServiceUrl,
  pathRewrite: { '^/auth': '' }
}));

app.use('/api', createProxyMiddleware({
  ...proxyCommon,
  target: config.apiServiceUrl,
  pathRewrite: { '^/api': '' }
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
