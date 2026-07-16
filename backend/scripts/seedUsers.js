// Creates a user account (owner or staff). Run manually — there is no public signup,
// since only 2-3 known people should ever have accounts (see prd.md).
//
// Usage:
//   node scripts/seedUsers.js <username> <password> <owner|staff>
//
// Example:
//   node scripts/seedUsers.js anshuman "a-strong-password" owner
//   node scripts/seedUsers.js counter-staff "another-password" staff

const bcrypt = require('bcrypt');
const db = require('../src/config/db');
const usersModel = require('../src/models/users.model');

const SALT_ROUNDS = 10;

async function run() {
  const [, , username, password, role] = process.argv;

  if (!username || !password || !role) {
    console.error('Usage: node scripts/seedUsers.js <username> <password> <owner|staff>');
    process.exit(1);
  }

  if (!['owner', 'staff'].includes(role)) {
    console.error('Role must be exactly "owner" or "staff".');
    process.exit(1);
  }

  const existing = await usersModel.findByUsername(username);
  if (existing) {
    console.error(`A user named "${username}" already exists — choose a different username.`);
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await usersModel.create({ username, password_hash, role });

  console.log(`Created ${user.role} account: "${user.username}" (id ${user.id})`);
  await db.pool.end();
}

run().catch((err) => {
  console.error('Failed to create user:', err);
  process.exit(1);
});
