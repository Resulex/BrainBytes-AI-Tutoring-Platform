const request = require('supertest');
const Message = require('../../models/Message');
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

describe('Messages API — GET /api/messages', () => {
  test('should return only the authenticated user messages', async () => {
    const { user: user1, token: token1 } = await createTestUser({ email: 'user1@test.com' });
    const { user: user2 } = await createTestUser({ email: 'user2@test.com' });

    await Message.create({ text: 'User1 message', isUser: true, userId: user1._id });
    await Message.create({ text: 'User2 message', isUser: true, userId: user2._id });

    const res = await request(app).get('/api/messages').set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('User1 message');
  });

  test('should paginate results', async () => {
    const { user, token } = await createTestUser();
    for (let i = 0; i < 5; i++) {
      await Message.create({ text: `msg ${i}`, isUser: true, userId: user._id });
    }

    const res = await request(app)
      .get('/api/messages?limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(3);
    expect(res.body.pagination.totalItems).toBe(5);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  test('should cap limit at 100', async () => {
    const { user, token } = await createTestUser();
    for (let i = 0; i < 50; i++) {
      await Message.create({ text: `msg ${i}`, isUser: true, userId: user._id });
    }

    const res = await request(app)
      .get('/api/messages?limit=999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBeLessThanOrEqual(100);
  });

  test('should reject without auth', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(401);
  });

  test('should filter by sessionId', async () => {
    const { user, token } = await createTestUser();
    const { user: user2 } = await createTestUser({ email: 'other@test.com' });

    // Create messages with different sessionIds
    const sessionId1 = '507f1f77bcf86cd799439011';
    const sessionId2 = '507f1f77bcf86cd799439012';

    await Message.create({
      text: 'Session1 msg',
      isUser: true,
      userId: user._id,
      sessionId: sessionId1,
    });
    await Message.create({
      text: 'Session2 msg',
      isUser: true,
      userId: user._id,
      sessionId: sessionId2,
    });

    const res = await request(app)
      .get(`/api/messages?sessionId=${sessionId1}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('Session1 msg');
  });
});
