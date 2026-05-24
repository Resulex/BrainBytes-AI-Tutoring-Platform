// IMPORTANT: Set JWT_SECRET before any module that requires auth.js
process.env.JWT_SECRET = 'brainbytes-test-secret';

const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const aiService = require('../aiService');
const { cacheMiddleware, cache } = require('../utils/cache');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { buildConversationContext } = require('../utils/contextBuilder');
const { suggestFollowUps } = require('../utils/followUpSuggestions');
const { formatMessage } = require('../utils/formatMessage');

// Track if MongoDB is already connected globally
let connected = false;

// Create an Express app configured exactly like the production server
function createApp() {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  const authRoutes = require('../routes/auth');
  const userRoutes = require('../routes/user');
  const learningMaterialRoutes = require('../routes/learningMaterials');
  const sessionRoutes = require('../routes/sessions');
  const preferenceRoutes = require('../routes/preferences');

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/materials', learningMaterialRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/preferences', preferenceRoutes);

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to the BrainBytes API',
      version: '2.0.0',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        messages: '/api/messages',
        materials: '/api/materials',
        sessions: '/api/sessions',
        preferences: '/api/preferences'
      }
    });
  });

  // GET /api/messages - Get messages with pagination
  app.get('/api/messages', authenticate, cacheMiddleware(30), async (req, res, next) => {
    try {
      const { sessionId, limit = 50, before, page = 1 } = req.query;
      const query = { userId: req.user._id };
      const pageSize = Math.min(parseInt(limit), 100);
      const skip = (parseInt(page) - 1) * pageSize;
      if (sessionId) query.sessionId = sessionId;
      if (before) query.createdAt = { $lt: new Date(before) };
      const [messages, total] = await Promise.all([
        Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        Message.countDocuments(query)
      ]);
      res.json({
        messages: messages.reverse(),
        pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / pageSize), totalItems: total, itemsPerPage: pageSize, hasMore: skip + pageSize < total }
      });
    } catch (err) { next(err); }
  });

  // POST /api/messages - Create a message and get AI response
  app.post('/api/messages', validate('message'), async (req, res, next) => {
    try {
      const { text, subject, sessionId } = req.body;
      const sanitizedText = req.body.text.trim();

      // Save user message
      const userMessage = new Message({
        text: sanitizedText,
        isUser: true,
        sessionId: sessionId || null
      });
      await userMessage.save();

      // Invalidate cache for this session's messages
      if (sessionId) {
        cache.del(`__cache__/api/messages?sessionId=${sessionId}`);
      }

      // Gather context if session ID provided
      let context = null;
      if (sessionId) {
        const recentMessages = await Message.find({ sessionId })
          .sort({ createdAt: -1 })
          .limit(10);
        context = buildConversationContext(recentMessages.reverse());
      }

      // Generate AI response
      const aiResult = await aiService.generateResponse(sanitizedText, subject, context)
        .catch(error => {
          console.error('AI response failed:', error);
          return {
            category: 'error',
            response: "I'm sorry, but I couldn't process your request in time. Please try again with a simpler question."
          };
        });

      // Generate follow-up suggestions
      const followUps = suggestFollowUps(aiResult.category, sanitizedText, aiResult.response);

      // Format the response
      const formatted = formatMessage(aiResult.response);

      // Save AI response
      const aiMessage = new Message({
        text: aiResult.response,
        isUser: false,
        sessionId: sessionId || null,
        category: aiResult.category,
        followUps,
        formattedContent: formatted
      });
      await aiMessage.save();

      // Return both messages
      res.status(201).json({
        userMessage,
        aiMessage,
        category: aiResult.category,
        followUps
      });
    } catch (err) {
      next(err);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function createTestUser(overrides = {}) {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(overrides.password || 'password123', salt);

  const userData = {
    name: overrides.name || 'Test User',
    email: overrides.email || `test-${Date.now()}@example.com`,
    password: hashedPassword,
    preferredSubjects: overrides.preferredSubjects || ['Mathematics', 'Science'],
    bio: overrides.bio || 'Test bio',
  };

  const user = await User.create(userData);
  const token = generateToken(user._id);
  return { user, token };
}

// Connect to MongoDB if not already connected — called in each test file's beforeAll
async function connectToDatabase() {
  if (connected) return;
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  global.__MONGO_SERVER__ = mongoServer;
  await mongoose.connect(uri);
  connected = true;
}

// Disconnect — called in each test file's afterAll (safe to call multiple times)
async function disconnectFromDatabase() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

// Clear all collections between tests (called in each test file's afterEach)
async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // Also flush the in-memory cache to prevent cross-test contamination
  cache.flush();
}

module.exports = { createApp, createTestUser, generateToken, connectToDatabase, disconnectFromDatabase, clearCollections };
