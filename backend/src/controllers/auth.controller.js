const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const usersModel = require('../models/users.model');
const { loginSchema } = require('../validators/auth.validator');

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true; // safe to show this message to the client (see errorHandler.js)
  return err;
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw makeError('Username and password are required.', 400, 'INVALID_INPUT');
    }

    const { username, password } = parsed.data;
    const user = await usersModel.findByUsername(username);

    // Same error whether the username doesn't exist or the password is wrong —
    // never reveal which usernames are valid.
    if (!user) {
      throw makeError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw makeError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      env.jwtSecret,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// Lets the frontend verify a stored token is still valid, and lets us verify
// end-to-end auth wiring works right after building it.
async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, me };
