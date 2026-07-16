// Single place where all environment variables are read and validated.
// Nothing else in the codebase should call process.env directly — import from here instead.
// This makes it obvious at a glance what config the app depends on, and fails fast
// on startup if something required is missing, rather than failing later mid-request.

require('dotenv').config();

const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'GEMINI_API_KEY',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // Fail loudly and immediately — a missing secret should never surface as a
  // confusing runtime error later during a scan or confirm action.
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  port: Number(process.env.PORT) || 3000,
};
