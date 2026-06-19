import rateLimit from 'express-rate-limit';

// Strict limiter for auth endpoints — prevents brute force and credential stuffing
// 5 attempts per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // Return rate limit info in 'RateLimit-*' headers
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      message: 'Too many attempts. Please try again after 15 minutes.',
    },
  },
  // Skip rate limit for refresh and logout, or during automated test suite runs
  skip: (req) => process.env.NODE_ENV === 'test' || req.path === '/logout',
});

// General API rate limiter — prevents abuse of any endpoint
// 100 requests per minute per IP
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      message: 'Too many requests. Please slow down.',
    },
  },
  // Skip general rate limiter in automated test environment
  skip: () => process.env.NODE_ENV === 'test',
});
