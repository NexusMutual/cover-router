const { inspect } = require('node:util');

/**
 * Request Logger Middleware
 *
 * Logs incoming requests with method, URL, params, and query.
 *
 * @param {import('express').Request} req - The Express request object
 * @param {import('express').Response} res - The Express response object
 * @param {Function} next - The next middleware function
 */
const requestLogger = (req, res, next) => {
  const params = Object.keys(req.params).length ? `\nparams: ${inspect(req.params, { depth: null })}` : '';
  const query = Object.keys(req.query).length ? `\nquery: ${inspect(req.query, { depth: null })}` : '';

  console.info(`${req.method} ${req.baseUrl}${req.route?.path || req.path}${params}${query}`);
  next();
};

module.exports = {
  requestLogger,
};
