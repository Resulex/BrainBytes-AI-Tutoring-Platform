require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const aiService = require('./aiService');
const { setupSocketHandlers } = require('./socket/handler');
const { cacheMiddleware, cache } = require('./utils/cache');
const { validate, sanitizeObject } = require('./middleware/validate');
const { errorHandler, notFoundHandler, AppError } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const learningMaterialRoutes = require('./routes/learningMaterials');
const sessionRoutes = require('./routes/sessions');
const preferenceRoutes = require('./routes/preferences');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing & cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// Initialize AI model
aiService.initializeAI();

// Connect to MongoDB
mongoose.connect('mongodb://mongo:27017/brainbytes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});

// API Routes
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

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/materials', learningMaterialRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/preferences', preferenceRoutes);

// REST Message endpoints (complementary to socket-based chat)
const Message = require('./models/Message');
const { buildConversationContext } = require('./utils/contextBuilder');
const { suggestFollowUps } = require('./utils/followUpSuggestions');
const { formatMessage } = require('./utils/formatMessage');

// GET /api/messages - Get messages (optionally filtered by session, with caching)
app.get('/api/messages', authenticate, cacheMiddleware(30), async (req, res, next) => {
  try {
    const { sessionId, limit = 50, before, page = 1 } = req.query;
    const query = { userId: req.user._id };
    const pageSize = Math.min(parseInt(limit), 100); // Cap at 100
    const skip = (parseInt(page) - 1) * pageSize;
    
    if (sessionId) query.sessionId = sessionId;
    if (before) query.createdAt = { $lt: new Date(before) };

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Message.countDocuments(query)
    ]);

    res.json({
      messages: messages.reverse(),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / pageSize),
        totalItems: total,
        itemsPerPage: pageSize,
        hasMore: skip + pageSize < total
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages - Create a message and get AI response (REST fallback)
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

// Start Socket.io handlers
setupSocketHandlers(io);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
