const request = require('supertest');
const Session = require('../../models/Session');
const Message = require('../../models/Message');
const { createApp, createTestUser, connectToDatabase, disconnectFromDatabase, clearCollections } = require('../setup');

const app = createApp();

beforeAll(connectToDatabase);
afterAll(disconnectFromDatabase);
afterEach(clearCollections);

describe('Sessions API — POST /api/sessions', () => {
  test('should create a new session', async () => {
    const { token } = await createTestUser();

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'math' });

    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.subject).toBe('math');
    expect(res.body.session.isActive).toBe(true);
  });

  test('should create session without auth (optionalAuth)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ subject: 'science' });

    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.userId).toBeNull();
  });
});

describe('Sessions API — GET /api/sessions', () => {
  test('should list user sessions with pagination', async () => {
    const { user, token } = await createTestUser();
    await Session.create({ userId: user._id, subject: 'science' });
    await Session.create({ userId: user._id, subject: 'history' });

    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalItems).toBe(2);
  });

  test('should filter by active sessions', async () => {
    const { user, token } = await createTestUser();
    await Session.create({ userId: user._id, subject: 'math', isActive: true });
    await Session.create({ userId: user._id, subject: 'history', isActive: false });

    const res = await request(app)
      .get('/api/sessions?active=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].subject).toBe('math');
  });
});

describe('Sessions API — GET /api/sessions/:id', () => {
  test('should return session with messages', async () => {
    const { user, token } = await createTestUser();
    const session = await Session.create({ userId: user._id });
    await Message.create({ sessionId: session._id, text: 'Hello', isUser: true, userId: user._id });

    const res = await request(app)
      .get(`/api/sessions/${session._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('Hello');
  });

  test('should return 404 for non-existent session', async () => {
    const { token } = await createTestUser();
    const fakeId = '507f1f77bcf86cd799439011'; // valid ObjectId format

    const res = await request(app)
      .get(`/api/sessions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('Sessions API — PUT /api/sessions/:id', () => {
  test('should update session subject', async () => {
    const { user, token } = await createTestUser();
    const session = await Session.create({ userId: user._id });

    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'science' });

    expect(res.status).toBe(200);
    expect(res.body.session.subject).toBe('science');
  });

  test('should end session when isActive=false', async () => {
    const { user, token } = await createTestUser();
    const session = await Session.create({ userId: user._id, isActive: true });

    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.session.isActive).toBe(false);
    expect(res.body.session.endedAt).toBeDefined();
  });

  test('should reject update without auth', async () => {
    const { user } = await createTestUser();
    const session = await Session.create({ userId: user._id });

    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .send({ subject: 'science' });

    expect(res.status).toBe(401);
  });
});
