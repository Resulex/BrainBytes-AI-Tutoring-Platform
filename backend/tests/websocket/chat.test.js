const http = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Message = require('../../models/Message');
const Session = require('../../models/Session');
const {
  createTestUser,
  connectToDatabase,
  disconnectFromDatabase,
  clearCollections,
} = require('../setup');
const { setupSocketHandlers } = require('../../socket/handler');

const JWT_SECRET = process.env.JWT_SECRET || 'brainbytes-dev-secret-key-change-in-production';

describe('WebSocket Chat Communication', () => {
  let httpServer, io, port;
  let user1, user2, token1, session;

  beforeAll(async () => {
    await connectToDatabase();

    httpServer = http.createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    setupSocketHandlers(io);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;

    // Create test users
    const u1 = await createTestUser({ email: 'socket-user1@test.com' });
    user1 = u1.user;
    token1 = u1.token;
    const u2 = await createTestUser({ email: 'socket-user2@test.com' });
    user2 = u2.user;

    session = await Session.create({ userId: user1._id, subject: 'math' });
  });

  afterAll(async () => {
    // Forcefully close all socket connections
    const sockets = await io.fetchSockets();
    sockets.forEach((s) => s.disconnect(true));
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
    await disconnectFromDatabase();
  });

  afterEach(clearCollections);

  test('should connect a client with auth token', (done) => {
    const client = ioc(`http://localhost:${port}`, {
      auth: { token: token1 },
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.close();
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  });

  test('should connect a client without auth token', (done) => {
    const client = ioc(`http://localhost:${port}`);

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.close();
      done();
    });
  });

  test('should join a session room and receive online count', (done) => {
    const client = ioc(`http://localhost:${port}`, {
      auth: { token: token1 },
    });

    client.on('connect', () => {
      client.emit('session:join', {
        sessionId: session._id.toString(),
        userName: 'TestUser',
      });
    });

    client.on('user:onlineCount', (data) => {
      expect(data.count).toBeGreaterThanOrEqual(1);
      client.close();
      done();
    });
  });

  test('should send a message and receive AI response', (done) => {
    const client = ioc(`http://localhost:${port}`, {
      auth: { token: token1 },
    });

    client.on('connect', () => {
      client.emit('session:join', {
        sessionId: session._id.toString(),
      });

      // Wait a moment for room join, then send message
      setTimeout(() => {
        client.emit('chat:message', {
          sessionId: session._id.toString(),
          text: 'What is 1+1?',
          subject: 'math',
        });
      }, 200);
    });

    // Should receive an AI response message
    let messageCount = 0;
    const aiTimeout = setTimeout(() => {
      client.close();
      done(new Error('Timeout waiting for AI response'));
    }, 15000);

    client.on('chat:message', (data) => {
      messageCount++;
      if (data.type === 'ai') {
        clearTimeout(aiTimeout);
        expect(data.message).toBeDefined();
        expect(data.message.text).toBeDefined();
        expect(data.message.text.length).toBeGreaterThan(0);
        expect(data.category).toBeDefined();
        client.close();
        done();
      }
    });
  });

  test('should save messages to database via socket', (done) => {
    const client = ioc(`http://localhost:${port}`, {
      auth: { token: token1 },
    });

    client.on('connect', () => {
      client.emit('session:join', {
        sessionId: session._id.toString(),
      });

      setTimeout(() => {
        client.emit('chat:message', {
          sessionId: session._id.toString(),
          text: 'What is photosynthesis?',
          subject: 'science',
        });
      }, 200);
    });

    const dbTimeout = setTimeout(() => {
      client.close();
      done(new Error('Timeout waiting for AI response in DB test'));
    }, 15000);

    client.on('chat:message', async (data) => {
      if (data.type === 'ai') {
        clearTimeout(dbTimeout);
        // Check database for the messages
        const messages = await Message.find({ sessionId: session._id });
        expect(messages.length).toBeGreaterThanOrEqual(2); // user msg + AI response

        const userMsg = messages.find((m) => m.isUser === true);
        expect(userMsg).toBeDefined();
        expect(userMsg.text).toBe('What is photosynthesis?');

        client.close();
        done();
      }
    });
  });

  test('should handle typing indicators', (done) => {
    const client1 = ioc(`http://localhost:${port}`, { auth: { token: token1 } });
    const client2 = ioc(`http://localhost:${port}`, {
      auth: { token: jwt.sign({ id: user2._id }, JWT_SECRET, { expiresIn: '7d' }) },
    });

    let client2Ready = false;
    let client1Done = false;

    client2.on('connect', () => {
      client2.emit('session:join', {
        sessionId: session._id.toString(),
        userName: 'User2',
      });
      client2Ready = true;
      tryTyping();
    });

    const tryTyping = () => {
      if (client1Done) return;
      client1.emit('chat:typing', {
        sessionId: session._id.toString(),
        isTyping: true,
      });
    };

    client2.on('chat:typing', (data) => {
      if (client1Done) return;
      client1Done = true;
      // typing event emitted from another user in the same session
      expect(data).toBeDefined();
      expect(data).toHaveProperty('isTyping');
      client1.close();
      client2.close();
      done();
    });

    // Safeguard
    setTimeout(() => {
      if (!client1Done) {
        client1Done = true;
        client1.close();
        client2.close();
        done(new Error('Timeout waiting for typing indicator'));
      }
    }, 5000);
  });

  test('should handle read receipts', (done) => {
    const client = ioc(`http://localhost:${port}`, { auth: { token: token1 } });

    client.on('connect', async () => {
      // Create a message to mark as read
      const msg = await Message.create({
        text: 'Test read receipt',
        isUser: false,
        sessionId: session._id,
        userId: user1._id,
      });

      client.emit('chat:readReceipt', {
        messageIds: [msg._id.toString()],
        sessionId: session._id.toString(),
      });

      // Check DB after sending receipt
      setTimeout(async () => {
        const updated = await Message.findById(msg._id);
        expect(updated.readAt).toBeDefined();
        expect(updated.readAt).toBeInstanceOf(Date);
        client.close();
        done();
      }, 500);
    });
  });

  test('should notify when a user disconnects', (done) => {
    const listener = ioc(`http://localhost:${port}`, { auth: { token: token1 } });
    const disconnector = ioc(`http://localhost:${port}`, {
      auth: { token: jwt.sign({ id: user2._id }, process.env.JWT_SECRET, { expiresIn: '7d' }) },
    });

    let testFinished = false;

    listener.on('connect', () => {
      listener.emit('session:join', { sessionId: session._id.toString(), userName: 'Listener' });
    });

    disconnector.on('connect', () => {
      disconnector.emit('session:join', {
        sessionId: session._id.toString(),
        userName: 'Disconnector',
      });
    });

    // user:joined is emitted to everyone EXCEPT the sender
    // So listener will receive it when disconnector joins
    listener.on('user:joined', () => {
      tryDisconnect();
    });

    listener.on('user:left', (data) => {
      if (testFinished) return;
      testFinished = true;
      expect(data).toBeDefined();
      expect(data.userId).toBe(user2._id.toString());
      listener.close();
      done();
    });

    function tryDisconnect() {
      // Wait a tick then disconnect
      setTimeout(() => {
        disconnector.close();
      }, 500);
    }

    setTimeout(() => {
      if (testFinished) return;
      testFinished = true;
      listener.close();
      disconnector.close();
      done(new Error('Timeout waiting for disconnect notification'));
    }, 5000);
  });

  test('should reject empty message', (done) => {
    const client = ioc(`http://localhost:${port}`, { auth: { token: token1 } });

    client.on('connect', () => {
      client.emit('session:join', {
        sessionId: session._id.toString(),
      });

      // Send empty message — should not save or crash
      client.emit('chat:message', {
        sessionId: session._id.toString(),
        text: '   ',
        subject: 'math',
      });

      // Wait a moment then check DB — should be no new messages
      setTimeout(async () => {
        const messages = await Message.find({ sessionId: session._id });
        const emptyMsgs = messages.filter((m) => m.text.trim() === '');
        expect(emptyMsgs.length).toBe(0);
        client.close();
        done();
      }, 500);
    });
  });
});
