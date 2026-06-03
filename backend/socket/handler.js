const Message = require('../models/Message');
const Session = require('../models/Session');
const aiService = require('../aiService');
const { suggestFollowUps } = require('../utils/followUpSuggestions');
const { buildConversationContext } = require('../utils/contextBuilder');

// Track online users and typing status
const onlineUsers = new Map(); // socketId -> { userId, name, sessionId }
const typingUsers = new Map(); // sessionId -> Set<socketId>

function setupSocketHandlers(io) {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
      } catch (err) {
        // Socket continues without auth
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(
      `Socket connected: ${socket.id}${socket.userId ? ' (user: ' + socket.userId + ')' : ''}`,
    );

    // --- Session Management ---
    socket.on('session:join', async (data) => {
      const { sessionId } = data;
      if (sessionId) {
        socket.join(`session:${sessionId}`);
        socket.currentSessionId = sessionId;

        // Track user
        onlineUsers.set(socket.id, {
          userId: socket.userId,
          name: data.userName || 'Anonymous',
          sessionId,
        });

        // Notify session about user presence
        socket.to(`session:${sessionId}`).emit('user:joined', {
          userId: socket.userId,
          name: data.userName || 'Anonymous',
        });

        // Emit current online count
        const sessionUsers = [...onlineUsers.values()].filter((u) => u.sessionId === sessionId);
        io.to(`session:${sessionId}`).emit('user:onlineCount', { count: sessionUsers.length });
      }
    });

    // --- Chat Messages via Socket ---
    socket.on('chat:message', async (data) => {
      const { text, subject, sessionId } = data;
      if (!text || !text.trim()) {
        return;
      }

      const actualSessionId = sessionId || socket.currentSessionId;

      try {
        // Save user message
        const userMessage = new Message({
          text: text.trim(),
          isUser: true,
          sessionId: actualSessionId,
          userId: socket.userId || null,
        });
        await userMessage.save();

        // Update session message count
        if (actualSessionId) {
          await Session.findByIdAndUpdate(actualSessionId, {
            $inc: { messageCount: 1 },
            lastActivity: Date.now(),
          });
        }

        // Emit typing indicator (AI is thinking)
        io.to(`session:${actualSessionId}`).emit('chat:typing', {
          userId: 'ai',
          isTyping: true,
        });

        // Gather recent context for AI
        let context = null;
        if (actualSessionId) {
          const recentMessages = await Message.find({ sessionId: actualSessionId })
            .sort({ createdAt: -1 })
            .limit(10);
          context = buildConversationContext(recentMessages.reverse());
        }

        // Generate AI response
        const aiResult = await aiService.generateResponse(text.trim(), subject, context);

        // Generate follow-up suggestions
        const followUps = suggestFollowUps(aiResult.category, text, aiResult.response);

        // Save AI message
        const aiMessage = new Message({
          text: aiResult.response,
          isUser: false,
          sessionId: actualSessionId,
          userId: socket.userId || null,
          category: aiResult.category,
          followUps,
        });
        await aiMessage.save();

        // Update session message count
        if (actualSessionId) {
          await Session.findByIdAndUpdate(actualSessionId, {
            $inc: { messageCount: 1 },
            subject: aiResult.category || subject || 'general',
          });
        }

        // Emit AI response
        io.to(`session:${actualSessionId}`).emit('chat:message', {
          message: aiMessage,
          type: 'ai',
          category: aiResult.category,
          followUps,
        });

        // Stop typing indicator
        io.to(`session:${actualSessionId}`).emit('chat:typing', {
          userId: 'ai',
          isTyping: false,
        });
      } catch (error) {
        console.error('Socket chat:message error:', error);
        io.to(`session:${actualSessionId}`).emit('chat:error', {
          message: "I'm sorry, I encountered an error processing your request. Please try again.",
        });
        io.to(`session:${actualSessionId}`).emit('chat:typing', {
          userId: 'ai',
          isTyping: false,
        });
      }
    });

    // --- Typing Indicators ---
    socket.on('chat:typing', (data) => {
      const { isTyping, sessionId } = data;
      const actualSessionId = sessionId || socket.currentSessionId;

      if (!actualSessionId) {
        return;
      }

      if (isTyping) {
        if (!typingUsers.has(actualSessionId)) {
          typingUsers.set(actualSessionId, new Set());
        }
        typingUsers.get(actualSessionId).add(socket.id);
      } else {
        const sessionTyping = typingUsers.get(actualSessionId);
        if (sessionTyping) {
          sessionTyping.delete(socket.id);
          if (sessionTyping.size === 0) {
            typingUsers.delete(actualSessionId);
          }
        }
      }

      const isAnyTyping =
        typingUsers.has(actualSessionId) && typingUsers.get(actualSessionId).size > 0;
      socket.to(`session:${actualSessionId}`).emit('chat:typing', {
        userId: socket.userId,
        isTyping: isAnyTyping,
      });
    });

    // --- Read Receipts ---
    socket.on('chat:readReceipt', async (data) => {
      const { messageIds, sessionId } = data;
      if (!messageIds || !Array.isArray(messageIds)) {
        return;
      }

      try {
        await Message.updateMany(
          { _id: { $in: messageIds }, readAt: null },
          { readAt: new Date() },
        );

        socket.to(`session:${sessionId || socket.currentSessionId}`).emit('chat:readReceipt', {
          messageIds,
          readAt: new Date(),
          userId: socket.userId,
        });
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const userInfo = onlineUsers.get(socket.id);
      if (userInfo) {
        const { sessionId } = userInfo;
        onlineUsers.delete(socket.id);

        // Clean up typing status
        const sessionTyping = typingUsers.get(sessionId);
        if (sessionTyping) {
          sessionTyping.delete(socket.id);
          if (sessionTyping.size === 0) {
            typingUsers.delete(sessionId);
          }
        }

        // Notify session
        io.to(`session:${sessionId}`).emit('user:left', {
          userId: socket.userId,
          name: userInfo.name,
        });

        const sessionUsers = [...onlineUsers.values()].filter((u) => u.sessionId === sessionId);
        io.to(`session:${sessionId}`).emit('user:onlineCount', { count: sessionUsers.length });
      }
    });
  });
}

module.exports = { setupSocketHandlers };
