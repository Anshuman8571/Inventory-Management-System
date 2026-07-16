// Single shared Postgres connection pool, used by every model file.
// No other file in the codebase should create its own pool or client connection.

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
});

pool.on('error', (err) => {
  // Idle client errors (e.g. connection dropped by DB) should be logged, not crash the app.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = {
  // Always use parameterized queries: pool.query(text, [values]) — never string-concatenate SQL.
  query: (text, params) => pool.query(text, params),
  pool,
};
