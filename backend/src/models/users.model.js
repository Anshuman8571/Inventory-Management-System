const db = require('../config/db');

// One file per table, parameterized SQL only — no string concatenation (see rules.md).

async function findByUsername(username) {
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

async function create({ username, password_hash, role }) {
  const result = await db.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, username, role, created_at`,
    [username, password_hash, role]
  );
  return result.rows[0];
}

module.exports = { findByUsername, create };
