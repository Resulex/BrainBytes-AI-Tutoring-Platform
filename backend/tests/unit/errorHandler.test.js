const {
  AppError,
  errorHandler,
  notFoundHandler,
  catchAsync,
} = require('../../middleware/errorHandler');

describe('AppError', () => {
  test('creates an operational error with status code and message', () => {
    const err = new AppError('Something went wrong', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
    expect(err.details).toBeNull();
  });

  test('creates error with details', () => {
    const err = new AppError('Validation failed', 400, ['Name is required']);
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual(['Name is required']);
  });

  test('default status code is 500', () => {
    const err = new AppError('Server error');
    expect(err.statusCode).toBe(500);
  });

  test('has a stack trace', () => {
    const err = new AppError('Test');
    expect(err.stack).toBeDefined();
  });
});

describe('errorHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = { originalUrl: '/api/test', method: 'GET' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('handles generic Error with default 500', () => {
    const err = new Error('Something broke');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Something broke',
    });
    expect(console.error).toHaveBeenCalled();
  });

  test('handles AppError with custom status code', () => {
    const err = new AppError('Not found', 404);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not found',
    });
  });

  test('includes details in response when present', () => {
    const err = new AppError('Validation failed', 400, ['Field X is required']);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: ['Field X is required'],
    });
  });

  test('handles Mongoose CastError', () => {
    const err = new Error('Cast error');
    err.name = 'CastError';
    err.path = '_id';
    err.value = 'bad-id';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid _id: bad-id',
    });
  });

  test('handles Mongoose ValidationError', () => {
    const err = new Error('Validation error');
    err.name = 'ValidationError';
    err.errors = {
      email: { message: 'Email is required' },
      name: { message: 'Name is too short' },
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed.',
      details: ['Email is required', 'Name is too short'],
    });
  });

  test('handles Mongoose duplicate key error (code 11000)', () => {
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyValue = { email: 'test@test.com' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Duplicate value for email. This email is already taken.',
    });
  });

  test('handles JWT JsonWebTokenError', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token. Please log in again.',
    });
  });

  test('handles JWT TokenExpiredError', () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Your session has expired. Please log in again.',
    });
  });

  test('handles RateLimitError', () => {
    const err = new Error('Rate limit');
    err.name = 'RateLimitError';
    err.msBeforeNext = 5000;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many requests. Please try again later.',
      retryAfter: 5,
    });
  });

  test('logs the error with timestamp and path', () => {
    const err = new Error('Log test');

    errorHandler(err, req, res, next);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      expect.objectContaining({
        message: 'Log test',
        path: '/api/test',
        method: 'GET',
      }),
    );
  });

  test('includes stack in response in development mode', () => {
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error');

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Dev error',
        stack: expect.any(String),
      }),
    );

    process.env.NODE_ENV = origNodeEnv;
  });

  test('does not include stack in non-development mode', () => {
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const err = new Error('Prod error');

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.stack).toBeUndefined();

    process.env.NODE_ENV = origNodeEnv;
  });
});

describe('notFoundHandler', () => {
  test('calls next with a 404 AppError', () => {
    const req = { method: 'GET', originalUrl: '/api/nonexistent' };
    const res = {};
    const next = jest.fn();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Route not found');
    expect(err.message).toContain('GET');
    expect(err.message).toContain('/api/nonexistent');
  });
});

describe('catchAsync', () => {
  test('wraps a successful async function', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const handler = jest.fn().mockResolvedValue('success');

    const wrapped = catchAsync(handler);
    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('catches errors and passes them to next', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const error = new Error('Async failure');
    const handler = jest.fn().mockRejectedValue(error);

    const wrapped = catchAsync(handler);
    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  test('catches rejected promises (async errors)', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const error = new Error('Async rejection');
    const handler = jest.fn().mockRejectedValue(error);

    const wrapped = catchAsync(handler);
    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  test('does not call next when function resolves', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const handler = jest.fn().mockResolvedValue({});

    const wrapped = catchAsync(handler);
    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});
