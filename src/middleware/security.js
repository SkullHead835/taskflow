/**
 * Security headers and rate limiting middleware.
 */

/**
 * Applies defense-in-depth HTTP security headers to all responses.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'");
  next();
}

/**
 * Creates an in-memory sliding-window rate limiter middleware.
 *
 * @param {object} [options={}]
 * @param {number} [options.windowMs=900000] - Window duration in milliseconds (default 15 mins)
 * @param {number} [options.max=100] - Max requests allowed per window
 * @param {string} [options.message='Too many requests from this IP, please try again later']
 * @param {boolean} [options.enabled=true]
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs !== undefined ? options.windowMs : 15 * 60 * 1000;
  const max = options.max !== undefined ? options.max : 100;
  const message = options.message || 'Too many requests from this IP, please try again later';
  const hits = new Map();

  // Periodic cleanup to avoid memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, Math.min(windowMs, 60000));
  if (interval.unref) interval.unref();

  const limiter = (req, res, next) => {
    if (options.enabled === false) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message
        }
      });
    }

    next();
  };

  limiter.reset = () => hits.clear();
  return limiter;
}

module.exports = {
  securityHeaders,
  createRateLimiter
};
