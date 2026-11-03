/**
 * Authentication and Role-based Access Control Middleware
 * CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
 */

// Middleware to ensure a user is logged in
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // API request or AJAX -> return JSON 401
  if (req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }

  // Web page request -> redirect to login
  return res.redirect('/login');
}

// Middleware to enforce specific roles (e.g. 'admin', 'chairperson', 'student')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Please log in.'
        });
      }
      return res.redirect('/login');
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Role unauthorized
    if (req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${userRole}' is not authorized to access this resource.`
      });
    }

    // Friendly Access Denied page
    return res.status(403).redirect('/access-denied');
  };
}

module.exports = {
  requireLogin,
  requireRole
};
