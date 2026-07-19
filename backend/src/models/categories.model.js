// All SQL for the categories table (see migration 007 & 008). Deliberately tiny — this
// table only exists to let products.category be validated against a real,
// user-extensible list instead of a hardcoded 3-item CHECK constraint.

const db = require('../config/db');

function runner(client) {
  return client || db;
}

async function list(client) {
  const result = await runner(client).query('SELECT name, parent_name FROM categories ORDER BY name');
  return result.rows;
}

// Case-insensitive lookup — used to (a) validate a category exists before it's
// used on a product, and (b) stop "PPR" and "ppr" from becoming separate rows.
async function findByNameCaseInsensitive(name, client) {
  if (!name) return null;
  const result = await runner(client).query(
    'SELECT name, parent_name FROM categories WHERE lower(name) = lower($1)',
    [name]
  );
  return result.rows[0] || null;
}

async function create(name, parentName = null, client) {
  const result = await runner(client).query(
    'INSERT INTO categories (name, parent_name) VALUES ($1, $2) RETURNING name, parent_name',
    [name, parentName]
  );
  return result.rows[0];
}

module.exports = { list, findByNameCaseInsensitive, create };