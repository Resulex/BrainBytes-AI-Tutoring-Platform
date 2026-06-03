const request = require('supertest');
const UserPreference = require('../../models/UserPreference');
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

describe('Preferences API — GET /api/preferences', () => {
  test('should return defaults for new user', async () => {
    const { token } = await createTestUser();

    const res = await request(app).get('/api/preferences').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('light');
    expect(res.body.preferences.fontSize).toBe('medium');
    expect(res.body.preferences.language).toBe('en');
    expect(res.body.preferences.notifications.email).toBe(false);
    expect(res.body.preferences.chatSettings.showTimestamps).toBe(true);
  });

  test('should reject without auth', async () => {
    const res = await request(app).get('/api/preferences');
    expect(res.status).toBe(401);
  });
});

describe('Preferences API — PUT /api/preferences', () => {
  test('should update preferences', async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', fontSize: 'large' });

    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('dark');
    expect(res.body.preferences.fontSize).toBe('large');
  });

  test('should only update allowed fields (prevent injection)', async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', maliciousField: 'injected', xss: '<script>alert(1)</script>' });

    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('dark');
    expect(res.body.preferences.maliciousField).toBeUndefined();
    expect(res.body.preferences.xss).toBeUndefined();
  });

  test('should persist preferences across requests', async () => {
    const { token } = await createTestUser();

    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'fil' });

    const res = await request(app).get('/api/preferences').set('Authorization', `Bearer ${token}`);

    expect(res.body.preferences.language).toBe('fil');
  });

  test('should create preferences document on first update (upsert)', async () => {
    const { user, token } = await createTestUser();

    // No preferences doc exists yet
    const before = await UserPreference.findOne({ userId: user._id });
    expect(before).toBeNull();

    await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark' });

    // After update, doc should exist
    const after = await UserPreference.findOne({ userId: user._id });
    expect(after).not.toBeNull();
    expect(after.theme).toBe('dark');
  });

  test('should reject invalid enum values', async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .put('/api/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'neon' });

    expect(res.status).toBe(400);
  });
});
