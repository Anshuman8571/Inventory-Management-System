// Usage: router.delete('/products/:id', requireAuth, requireRole('owner'), controller.remove)
// Must always be used AFTER requireAuth, since it depends on req.user being set.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const err = new Error('You do not have permission to perform this action.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      err.expose = true;
      return next(err);
    }
    next();
  };
}

module.exports = requireRole;
