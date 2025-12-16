import pkg from 'pg';
import { config } from './config.js';
const { Pool } = pkg;

export const pool = new Pool({ connectionString: config.dbUrl });

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
