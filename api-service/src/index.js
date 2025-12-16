import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { query } from './db.js';
import { authenticate, ensureActiveUser, requireAdmin } from './auth.js';
import { ticketCreateSchema, ticketUpdateSchema } from './validation.js';
import { logAction } from './audit.js';

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || 'https://localhost:4173',
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
      connectSrc: ["'self'", corsOptions.origin],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('combined'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(authenticate);
app.use(ensureActiveUser);

app.get('/tickets', async (req, res) => {
  try {
    const params = [];
    let sql = 'SELECT * FROM tickets';
    if (req.user.role !== 'ADMIN') {
      sql += ' WHERE user_id=$1';
      params.push(req.user.sub);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/tickets', async (req, res) => {
  const parsed = ticketCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const { title, description, priority = 'medium', status = 'open' } = parsed.data;
  try {
    const result = await query(
      'INSERT INTO tickets(user_id, title, description, priority, status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [req.user.sub, title, description, priority, status]
    );
    await logAction(req.user.sub, 'ticket_created', { ticket: result.rows[0].id });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/tickets/:id', async (req, res) => {
  const ticketRes = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
  if (ticketRes.rowCount === 0) return res.status(404).json({ message: 'Not found' });
  const ticket = ticketRes.rows[0];
  if (ticket.user_id !== req.user.sub && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  return res.json(ticket);
});

app.patch('/tickets/:id', async (req, res) => {
  const parsed = ticketUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload' });
  const ticketRes = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
  if (ticketRes.rowCount === 0) return res.status(404).json({ message: 'Not found' });
  const ticket = ticketRes.rows[0];
  if (ticket.user_id !== req.user.sub && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const updates = { ...ticket, ...parsed.data, updated_at: new Date() };
  const result = await query(
    'UPDATE tickets SET title=$1, description=$2, priority=$3, status=$4, updated_at=$5 WHERE id=$6 RETURNING *',
    [updates.title, updates.description, updates.priority || 'medium', updates.status || 'open', updates.updated_at, req.params.id]
  );
  await logAction(req.user.sub, 'ticket_updated', { ticket: req.params.id });
  return res.json(result.rows[0]);
});

app.delete('/tickets/:id', async (req, res) => {
  const ticketRes = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
  if (ticketRes.rowCount === 0) return res.status(404).json({ message: 'Not found' });
  const ticket = ticketRes.rows[0];
  if (ticket.user_id !== req.user.sub && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  await query('DELETE FROM tickets WHERE id=$1', [req.params.id]);
  await logAction(req.user.sub, 'ticket_deleted', { ticket: req.params.id });
  return res.json({ message: 'deleted' });
});

app.get('/audit', requireAdmin, async (req, res) => {
  const result = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  return res.json(result.rows);
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(config.port, () => {
  console.log(`api-service listening on ${config.port}`);
});
