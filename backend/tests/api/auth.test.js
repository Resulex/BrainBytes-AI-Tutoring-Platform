const request = require('supertest');
const {
  createApp,
  createTestUser,
  connectToDatabase,
  disconnectFromDatabase,
  clearCollections,
} = require('../setup');

const app = createApp();

beforeAll(connectToDatabase);
afterAll(disconnectFromDatabase);
afterEach(clearCollections);

describe('Auth API — POST /api/auth/register', () => {
  test('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.name).toBe('New User');
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('should reject duplicate email', async () => {
    await createTestUser({ email: 'dup@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dupe', email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('should reject missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'No Email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('should reject invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad Email', email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });

  test('should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short PW', email: 'short@example.com', password: '123' });

    expect(res.status).toBe(400);
  });

  test('should not expose password in responses', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Secure', email: 'secure@test.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.user).not.toHaveProperty('password');
  });
});

describe('Auth API — POST /api/auth/login', () => {
  test('should login with valid credentials', async () => {
    await createTestUser({ email: 'login@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('login@example.com');
  });

  test('should reject wrong password', async () => {
    await createTestUser({ email: 'wrongpw@example.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpw@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid email or password/i);
  });

  test('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('Auth API — GET /api/auth/me', () => {
  test('should return current user with valid token', async () => {
    const { token } = await createTestUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBeDefined();
  });

  test('should reject without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  test('should reject with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-here');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid token/i);
  });
});
