// IMPORTANT: Set JWT_SECRET before any module that requires auth.js
process.env.JWT_SECRET = 'brainbytes-test-secret';

const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const { cacheMiddleware } = require('../utils/cache');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

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
}

module.exports = { createApp, createTestUser, generateToken, connectToDatabase, disconnectFromDatabase, clearCollections };
