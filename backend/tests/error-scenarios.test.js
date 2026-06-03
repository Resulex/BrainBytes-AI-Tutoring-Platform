const request = require('supertest');
const {
  createApp,
  createTestUser,
  connectToDatabase,
  disconnectFromDatabase,
  clearCollections,
} = require('./setup');

const app = createApp();

beforeAll(connectToDatabase);
afterAll(disconnectFromDatabase);
afterEach(clearCollections);

describe('Error Scenarios', () => {
  describe('Authentication Errors', () => {
    test('401 — should reject requests without auth token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    test('401 — should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(res.status).toBe(401);
      // Could be "invalid token" or "jwt malformed" depending on JWT library
      expect(res.body.error).toBeDefined();
    });

    test('401 — should reject login with wrong credentials', async () => {
      await createTestUser({ email: 'secure@test.com', password: 'correctpw' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'secure@test.com', password: 'wrongpw' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid email or password/i);
    });
  });

  describe('Validation Errors', () => {
    test('400 — should reject malformed user ID format', async () => {
      const res = await request(app).get('/api/users/not-an-id');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid user ID/i);
    });

    test('400 — should validate required fields on registration', async () => {
      const res = await request(app).post('/api/auth/register').send({ name: 'No Password' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('400 — should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Bad Email', email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
    });

    test('400 — should reject invalid preferred subjects', async () => {
      const { user, token } = await createTestUser();

      const res = await request(app)
        .put(`/api/users/${user._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredSubjects: ['InvalidSubject'] });

      expect(res.status).toBe(400);
    });

    test('400 — should reject material with missing fields', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/api/materials')
        .set('Authorization', `Bearer ${token}`)
        .send({ topic: 'Incomplete' });

      expect(res.status).toBe(400);
    });
  });

  describe('Not Found Errors', () => {
    test('404 — should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });

    test('404 — should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).get(`/api/users/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('Duplicate / Conflict Errors', () => {
    test('400 — should reject duplicate email registration', async () => {
      await createTestUser({ email: 'dup@test.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Duplicate', email: 'dup@test.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('Data Exposure', () => {
    test('should not expose password in user responses', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Secure', email: 'secure@test.com', password: 'secret123' });

      expect(res.status).toBe(201);
      expect(res.body.user).not.toHaveProperty('password');
    });

    test('should not expose sensitive fields in user listings', async () => {
      await createTestUser({ email: 'test@test.com' });

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      res.body.forEach((user) => {
        expect(user).not.toHaveProperty('password');
      });
    });
  });
});
