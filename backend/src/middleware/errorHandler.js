// Centralized error handler — every route's errors flow through here via next(err).
// Ensures a consistent response shape and never leaks raw stack traces/DB errors to the client.

function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const message = err.expose ? err.message : 'Something went wrong. Please try again.';
  const code = err.code || 'INTERNAL_ERROR';

  res.status(status).json({
    error: { message, code },
  });
}

module.exports = errorHandler;
