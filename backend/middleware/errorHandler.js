/**
 * Centralized error handling middleware.
 * Provides consistent error responses across all API endpoints.
 */

const logger = require('../utils/logger');

// Custom application error class
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Mongoose error handlers
function handleCastError(err) {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

function handleValidationError(err) {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError('Validation failed.', 400, messages);
}

function handleDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`Duplicate value for ${field}. This ${field} is already taken.`, 409);
}

// JWT error handlers
function handleJWTError() {
  return new AppError('Invalid token. Please log in again.', 401);
}

function handleJWTExpiredError() {
  return new AppError('Your session has expired. Please log in again.', 401);
}

// Main error handling middleware
function errorHandler(err, req, res, _next) {
  // Structured log
  logger.error(
    {
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      path: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode || err.status,
      errorName: err.name,
    },
    'Unhandled error',
  );

  // Default to 500
  let error = { ...err };
  error.message = err.message;

  // Handle Mongoose errors
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Handle rate limit errors
  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(err.msBeforeNext / 1000),
    });
  }

  // Build response
  const statusCode = error.statusCode || 500;
  const response = {
    error: error.message || 'Internal server error.',
  };

  if (error.details) {
    response.details = error.details;
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

// 404 handler for unknown routes
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// Async wrapper to catch errors in async route handlers
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  catchAsync,
};
