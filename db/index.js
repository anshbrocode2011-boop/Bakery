const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const LOCKED_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'anshbrocode2011@gmail.com';

async function initDb() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schemaSql);

  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) {
    console.warn('[DB] ADMIN_INITIAL_PASSWORD not set; admin account will not be created automatically.');
    return;
  }

  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Admin', $1, $2, 'admin')
      ON CONFLICT (email) DO NOTHING
    `,
    [LOCKED_ADMIN_EMAIL, passwordHash]
  );
}

module.exports = { pool, initDb, LOCKED_ADMIN_EMAIL };
