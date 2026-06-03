const request = require('supertest');
const User = require('../../models/User');
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

describe('Users API — PUT /api/users/:id', () => {
  test('should update own profile', async () => {
    const { user, token } = await createTestUser();

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', bio: 'Updated bio' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
    expect(res.body.user.bio).toBe('Updated bio');
  });

  test('should update preferred subjects', async () => {
    const { user, token } = await createTestUser();

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredSubjects: ['English', 'History'] });

    expect(res.status).toBe(200);
    expect(res.body.user.preferredSubjects).toEqual(['English', 'History']);
  });

  test('should reject invalid subject', async () => {
    const { user, token } = await createTestUser();

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredSubjects: ['InvalidSubject'] });

    expect(res.status).toBe(400);
  });

  test('should reject update without auth', async () => {
    const { user } = await createTestUser();

    const res = await request(app).put(`/api/users/${user._id}`).send({ name: 'Hacker' });

    expect(res.status).toBe(401);
  });

  test('should ignore other user ID and update own profile', async () => {
    const { user: user1 } = await createTestUser({ email: 'user1@test.com' });
    const { user: user2, token: token2 } = await createTestUser({ email: 'user2@test.com' });

    const res = await request(app)
      .put(`/api/users/${user1._id}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'User2 Renamed' });

    // The route uses req.user._id, so it updates the authenticated user (user2), not user1
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('User2 Renamed');

    // Verify user1 was NOT changed
    const freshUser1 = await User.findById(user1._id);
    expect(freshUser1.name).not.toBe('User2 Renamed');
  });
});

describe('Users API — GET /api/users', () => {
  test('should list all users', async () => {
    await createTestUser({ email: 'user1@example.com' });
    await createTestUser({ email: 'user2@example.com' });

    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('Users API — GET /api/users/:id', () => {
  test('should return a single user', async () => {
    const { user } = await createTestUser();

    const res = await request(app).get(`/api/users/${user._id}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  test('should return 404 for non-existent user', async () => {
    const { user } = await createTestUser();

    // Delete user first
    await User.findByIdAndDelete(user._id);

    const res = await request(app).get(`/api/users/${user._id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('should return 400 for invalid ID format', async () => {
    const res = await request(app).get('/api/users/invalid-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid user ID/i);
  });
});

describe('Users API — DELETE /api/users/:id', () => {
  test('should remove user', async () => {
    const { user } = await createTestUser();

    const res = await request(app).delete(`/api/users/${user._id}`);
    expect(res.status).toBe(200);

    const deleted = await User.findById(user._id);
    expect(deleted).toBeNull();
  });
});
