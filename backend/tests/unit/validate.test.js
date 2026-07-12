const logger = require('../../utils/logger');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { validate, sanitize, sanitizeObject, validators } = require('../../middleware/validate');

describe('validators', () => {
  describe('register', () => {
    test('passes for valid input', () => {
      const errors = validators.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
      expect(errors).toHaveLength(0);
    });

    test('rejects missing name', () => {
      const errors = validators.register({ email: 'test@test.com', password: '123456' });
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    test('rejects short name', () => {
      const errors = validators.register({ name: 'A', email: 'a@b.com', password: '123456' });
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    test('rejects missing email', () => {
      const errors = validators.register({ name: 'Test', password: '123456' });
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });

    test('rejects invalid email', () => {
      const errors = validators.register({ name: 'Test', email: 'notanemail', password: '123456' });
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });

    test('rejects missing password', () => {
      const errors = validators.register({ name: 'Test', email: 'a@b.com' });
      expect(errors.some((e) => e.includes('Password'))).toBe(true);
    });

    test('rejects short password', () => {
      const errors = validators.register({ name: 'Test', email: 'a@b.com', password: '12345' });
      expect(errors.some((e) => e.includes('Password'))).toBe(true);
    });

    test('rejects non-string password', () => {
      const errors = validators.register({ name: 'Test', email: 'a@b.com', password: 123456 });
      expect(errors.some((e) => e.includes('Password'))).toBe(true);
    });

    test('returns multiple errors at once', () => {
      const errors = validators.register({});
      expect(errors.length).toBeGreaterThanOrEqual(3); // name, email, password
    });
  });

  describe('login', () => {
    test('passes for valid input', () => {
      const errors = validators.login({ email: 'test@test.com', password: '123456' });
      expect(errors).toHaveLength(0);
    });

    test('rejects missing email', () => {
      const errors = validators.login({ password: '123456' });
      expect(errors.some((e) => e.includes('Email'))).toBe(true);
    });

    test('rejects missing password', () => {
      const errors = validators.login({ email: 'test@test.com' });
      expect(errors.some((e) => e.includes('Password'))).toBe(true);
    });

    test('rejects empty body', () => {
      const errors = validators.login({});
      expect(errors).toHaveLength(2);
    });
  });

  describe('message', () => {
    test('passes for valid message', () => {
      const errors = validators.message({ text: 'Hello world' });
      expect(errors).toHaveLength(0);
    });

    test('passes with subject', () => {
      const errors = validators.message({ text: 'Question', subject: 'math' });
      expect(errors).toHaveLength(0);
    });

    test('rejects missing text', () => {
      const errors = validators.message({});
      expect(errors.some((e) => e.includes('text'))).toBe(true);
    });

    test('rejects empty text', () => {
      const errors = validators.message({ text: '' });
      expect(errors.some((e) => e.includes('text'))).toBe(true);
    });

    test('rejects whitespace-only text', () => {
      const errors = validators.message({ text: '   ' });
      expect(errors.some((e) => e.includes('text'))).toBe(true);
    });

    test('rejects text over 5000 characters', () => {
      const errors = validators.message({ text: 'x'.repeat(5001) });
      expect(errors.some((e) => e.includes('5000'))).toBe(true);
    });

    test('accepts text exactly at 5000 characters', () => {
      const errors = validators.message({ text: 'x'.repeat(5000) });
      expect(errors.some((e) => e.includes('5000'))).toBe(false);
    });

    test('rejects invalid subject', () => {
      const errors = validators.message({ text: 'Hello', subject: 'invalid' });
      expect(errors.some((e) => e.includes('Subject'))).toBe(true);
    });

    test('accepts empty string subject', () => {
      const errors = validators.message({ text: 'Hello', subject: '' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('userCreate', () => {
    test('passes for valid input', () => {
      const errors = validators.userCreate({
        name: 'New User',
        email: 'new@test.com',
      });
      expect(errors).toHaveLength(0);
    });

    test('rejects missing name', () => {
      const errors = validators.userCreate({ email: 'a@b.com' });
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    test('rejects invalid email', () => {
      const errors = validators.userCreate({ name: 'Test', email: 'bad' });
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });

    test('rejects non-array preferredSubjects', () => {
      const errors = validators.userCreate({
        name: 'Test',
        email: 'a@b.com',
        preferredSubjects: 'math',
      });
      expect(errors.some((e) => e.includes('array'))).toBe(true);
    });

    test('accepts array preferredSubjects', () => {
      const errors = validators.userCreate({
        name: 'Test',
        email: 'a@b.com',
        preferredSubjects: ['math', 'science'],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('userUpdate', () => {
    test('passes for valid input', () => {
      const errors = validators.userUpdate({ name: 'Updated' });
      expect(errors).toHaveLength(0);
    });

    test('passes for empty body', () => {
      const errors = validators.userUpdate({});
      expect(errors).toHaveLength(0);
    });

    test('rejects short name when provided', () => {
      const errors = validators.userUpdate({ name: 'A' });
      expect(errors.some((e) => e.includes('Name'))).toBe(true);
    });

    test('rejects invalid email when provided', () => {
      const errors = validators.userUpdate({ email: 'bad' });
      expect(errors.some((e) => e.includes('email'))).toBe(true);
    });

    test('rejects non-array preferredSubjects', () => {
      const errors = validators.userUpdate({ preferredSubjects: 'notarray' });
      expect(errors.some((e) => e.includes('array'))).toBe(true);
    });

    test('accepts undefined name (optional field)', () => {
      const errors = validators.userUpdate({ bio: 'New bio' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('sessionCreate', () => {
    test('passes for empty body', () => {
      const errors = validators.sessionCreate({});
      expect(errors).toHaveLength(0);
    });

    test('passes with valid subject', () => {
      const errors = validators.sessionCreate({ subject: 'math' });
      expect(errors).toHaveLength(0);
    });

    test('rejects invalid subject', () => {
      const errors = validators.sessionCreate({ subject: 'invalid' });
      expect(errors.some((e) => e.includes('Subject'))).toBe(true);
    });

    test('accepts empty string subject', () => {
      const errors = validators.sessionCreate({ subject: '' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('preferences', () => {
    test('passes for valid input', () => {
      const errors = validators.preferences({
        theme: 'dark',
        fontSize: 'large',
        language: 'en',
      });
      expect(errors).toHaveLength(0);
    });

    test('passes for empty body', () => {
      const errors = validators.preferences({});
      expect(errors).toHaveLength(0);
    });

    test('rejects invalid theme', () => {
      const errors = validators.preferences({ theme: 'red' });
      expect(errors.some((e) => e.includes('Theme'))).toBe(true);
    });

    test('rejects invalid fontSize', () => {
      const errors = validators.preferences({ fontSize: 'huge' });
      expect(errors.some((e) => e.includes('Font size'))).toBe(true);
    });

    test('rejects invalid language', () => {
      const errors = validators.preferences({ language: 'fr' });
      expect(errors.some((e) => e.includes('Language'))).toBe(true);
    });

    test('accepts valid individual fields', () => {
      expect(validators.preferences({ theme: 'light' })).toHaveLength(0);
      expect(validators.preferences({ fontSize: 'medium' })).toHaveLength(0);
      expect(validators.preferences({ language: 'fil' })).toHaveLength(0);
      expect(validators.preferences({ language: 'tl' })).toHaveLength(0);
    });
  });

  describe('learningMaterial', () => {
    test('passes for valid input', () => {
      const errors = validators.learningMaterial({
        subject: 'Mathematics',
        topic: 'Algebra',
        content: 'Algebra is a branch of mathematics.',
      });
      expect(errors).toHaveLength(0);
    });

    test('rejects missing subject', () => {
      const errors = validators.learningMaterial({ topic: 'Algebra', content: 'Content here...' });
      expect(errors.some((e) => e.includes('Subject'))).toBe(true);
    });

    test('rejects short topic', () => {
      const errors = validators.learningMaterial({
        subject: 'Math',
        topic: 'AB',
        content: 'Valid content here.',
      });
      expect(errors.some((e) => e.includes('Topic'))).toBe(true);
    });

    test('rejects short content', () => {
      const errors = validators.learningMaterial({
        subject: 'Math',
        topic: 'Algebra',
        content: 'Short',
      });
      expect(errors.some((e) => e.includes('Content'))).toBe(true);
    });

    test('rejects invalid difficulty', () => {
      const errors = validators.learningMaterial({
        subject: 'Math',
        topic: 'Algebra',
        content: 'Valid content here with enough chars.',
        difficulty: 'expert',
      });
      expect(errors.some((e) => e.includes('Difficulty'))).toBe(true);
    });

    test('accepts valid difficulty values', () => {
      const base = {
        subject: 'Math',
        topic: 'Algebra',
        content: 'Valid content with enough chars',
      };
      expect(validators.learningMaterial({ ...base, difficulty: 'beginner' })).toHaveLength(0);
      expect(validators.learningMaterial({ ...base, difficulty: 'intermediate' })).toHaveLength(0);
      expect(validators.learningMaterial({ ...base, difficulty: 'advanced' })).toHaveLength(0);
    });
  });
});

describe('validate middleware', () => {
  test('calls next() when validation passes', () => {
    const req = { body: { text: 'Hello' } };
    const res = {};
    const next = jest.fn();

    const middleware = validate('message');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('returns 400 with details when validation fails', () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    const middleware = validate('message');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed.',
        details: expect.any(Array),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next for unknown schema name', () => {
    const req = { body: {} };
    const res = {};
    const next = jest.fn();

    const middleware = validate('nonexistent');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { schemaName: 'nonexistent' },
      'Unknown validation schema requested',
    );
  });
});

describe('sanitize', () => {
  test('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  test('strips angle brackets', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
  });

  test('returns non-strings unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
    expect(sanitize({ key: 'val' })).toEqual({ key: 'val' });
  });

  test('preserves safe characters', () => {
    expect(sanitize('Hello, world!')).toBe('Hello, world!');
    expect(sanitize('test@email.com')).toBe('test@email.com');
  });
});

describe('sanitizeObject', () => {
  test('recursively sanitizes string values', () => {
    const input = {
      name: '  <b>Test</b>  ',
      nested: { value: '<script>' },
      num: 42,
    };
    const result = sanitizeObject(input);

    expect(result.name).toBe('bTest/b');
    expect(result.nested.value).toBe('script');
    expect(result.num).toBe(42);
  });

  test('handles arrays', () => {
    const input = ['  hello  ', '<tag>'];
    const result = sanitizeObject(input);

    expect(result[0]).toBe('hello');
    expect(result[1]).toBe('tag');
  });

  test('returns primitives unchanged', () => {
    expect(sanitizeObject(null)).toBeNull();
    expect(sanitizeObject(undefined)).toBeUndefined();
    expect(sanitizeObject(42)).toBe(42);
  });
});
