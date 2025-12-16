import { query } from './db.js';

export async function logAction(userId, action, metadata = {}) {
  try {
    await query('INSERT INTO audit_logs(user_id, action, metadata) VALUES($1,$2,$3)', [userId || null, action, metadata]);
  } catch (err) {
    console.error('audit log failed', err.message);
  }
}
