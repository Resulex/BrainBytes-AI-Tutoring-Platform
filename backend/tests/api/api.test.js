const request = require('supertest');
const Message = require('../../models/Message');
const { createApp, createTestUser, connectToDatabase, disconnectFromDatabase, clearCollections } = require('../setup');

const app = createApp();

beforeAll(connectToDatabase);
afterAll(disconnectFromDatabase);
afterEach(clearCollections);

describe('Health Check — GET /', () => {
  test('should return API health status with version and endpoints', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Welcome to the BrainBytes API');
    expect(res.body.version).toBe('2.0.0');
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.endpoints.auth).toBe('/api/auth');
    expect(res.body.endpoints.users).toBe('/api/users');
    expect(res.body.endpoints.messages).toBe('/api/messages');
    expect(res.body.endpoints.materials).toBe('/api/materials');
    expect(res.body.endpoints.sessions).toBe('/api/sessions');
    expect(res.body.endpoints.preferences).toBe('/api/preferences');
  });

  test('should return 404 for unknown root routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('Chat API — POST /api/messages', () => {
  test('should send a message and receive AI response', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'What is 1+1?' });

    expect(res.status).toBe(201);
    expect(res.body.userMessage).toBeDefined();
    expect(res.body.aiMessage).toBeDefined();
    expect(res.body.userMessage.text).toBe('What is 1+1?');
    expect(res.body.userMessage.isUser).toBe(true);
    expect(res.body.aiMessage.isUser).toBe(false);
    expect(res.body.aiMessage.text).toBeDefined();
    expect(res.body.category).toBeDefined();
    expect(res.body.followUps).toBeDefined();
    expect(Array.isArray(res.body.followUps)).toBe(true);
  });

  test('should persist both user and AI messages to database', async () => {
    await request(app)
      .post('/api/messages')
      .send({ text: 'Explain evaporation' });

    const messages = await Message.find().sort({ createdAt: 1 });
    expect(messages.length).toBe(2);
    expect(messages[0].text).toBe('Explain evaporation');
    expect(messages[0].isUser).toBe(true);
    expect(messages[1].isUser).toBe(false);
    expect(messages[1].text).toBeDefined();
  });

  test('should associate messages with a sessionId when provided', async () => {
    const sessionId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'Tell me about history', sessionId });

    expect(res.status).toBe(201);
    expect(res.body.userMessage.sessionId).toBe(sessionId);
    expect(res.body.aiMessage.sessionId).toBe(sessionId);

    const messages = await Message.find({ sessionId });
    expect(messages.length).toBe(2);
  });

  test('should detect math category from question content', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'Can you help me with my algebra homework?' });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('math');
  });

  test('should detect science category from question content', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'I need help understanding physics concepts' });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('science');
  });

  test('should detect history category from question content', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'Tell me about world war 2' });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('history');
  });

  test('should reject empty message text', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ text: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('should reject missing text field', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ subject: 'math' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('should handle AI service failure gracefully', async () => {
    const originalToken = process.env.HUGGINGFACE_TOKEN;
    delete process.env.HUGGINGFACE_TOKEN;

    const res = await request(app)
      .post('/api/messages')
      .send({ text: 'This should still work' });

    expect(res.status).toBe(201);
    expect(res.body.userMessage).toBeDefined();
    expect(res.body.aiMessage).toBeDefined();
    expect(res.body.aiMessage.text).toBeDefined();
    expect(res.body.aiMessage.text.length).toBeGreaterThan(0);

    if (originalToken) process.env.HUGGINGFACE_TOKEN = originalToken;
  });
});

describe('History API — GET /api/messages', () => {
  test('should return message history for authenticated user', async () => {
    const { user, token } = await createTestUser();

    await Message.create({ text: 'Hello', isUser: true, userId: user._id });
    await Message.create({ text: 'Hi there!', isUser: false, userId: user._id });

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(2);
    expect(res.body.messages[0].text).toBe('Hello');
    expect(res.body.messages[1].text).toBe('Hi there!');
  });

  test('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/messages');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  test('should paginate history results', async () => {
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

  test('should filter history by sessionId', async () => {
    const { user, token } = await createTestUser();
    const sessionId = '507f1f77bcf86cd799439011';

    await Message.create({ text: 'Session msg', isUser: true, userId: user._id, sessionId });
    await Message.create({ text: 'No session msg', isUser: true, userId: user._id });

    const res = await request(app)
      .get(`/api/messages?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('Session msg');
  });

  test('should return only the authenticated user messages', async () => {
    const { user: user1, token: token1 } = await createTestUser({ email: 'user1@test.com' });
    const { user: user2 } = await createTestUser({ email: 'user2@test.com' });

    await Message.create({ text: 'User1 message', isUser: true, userId: user1._id });
    await Message.create({ text: 'User2 message', isUser: true, userId: user2._id });

    const res = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('User1 message');
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
});
