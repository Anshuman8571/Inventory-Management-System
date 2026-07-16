// Runs every .sql file in /migrations, in filename order, against the configured database.
// Each migration uses `CREATE TABLE IF NOT EXISTS`, so re-running this script is safe.

const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // filenames are zero-padded numbers, so alphabetical sort = execution order

  console.log(`Found ${files.length} migration file(s).`);

  for (const file of files) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`Applying ${file}...`);
    await db.query(sql);
  }

  console.log('All migrations applied successfully.');
  await db.pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
