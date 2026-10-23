const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const LOCKED_ADMIN_EMAIL = 'anshbrocode2011@gmail.com';

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  const adminEmail = (process.env.ADMIN_EMAIL || LOCKED_ADMIN_EMAIL).toLowerCase().trim();
  if (adminEmail !== LOCKED_ADMIN_EMAIL) {
    throw new Error(`Security policy violation: ADMIN_EMAIL must be ${LOCKED_ADMIN_EMAIL}`);
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword || initialPassword.length < 8) {
    console.warn('[WARN] Set a strong ADMIN_INITIAL_PASSWORD (min 8 chars) in .env to initialize the admin account.');
    return;
  }

  const existing = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = $1', [LOCKED_ADMIN_EMAIL]);
  const hash = await bcrypt.hash(initialPassword, 12);

  if (existing.rowCount === 0) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      ['Super Bakery Admin', LOCKED_ADMIN_EMAIL, hash]
    );
    console.log(`[DB] Seeded locked admin account for ${LOCKED_ADMIN_EMAIL}`);
  } else if (existing.rows[0].role !== 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [existing.rows[0].id]);
  }
}

module.exports = { pool, initDb, LOCKED_ADMIN_EMAIL };
