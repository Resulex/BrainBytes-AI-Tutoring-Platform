const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Message text is required'],
    trim: true
  },
  isUser: {
    type: Boolean,
    default: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  category: {
    type: String,
    enum: ['math', 'science', 'history', 'general', 'error'],
    default: 'general'
  },
  followUps: {
    type: [String],
    default: []
  },
  formattedContent: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for common queries
messageSchema.index({ createdAt: -1 }); // Default message listing
messageSchema.index({ sessionId: 1, createdAt: -1 }); // Session messages (pagination)
messageSchema.index({ userId: 1, createdAt: -1 }); // User's messages
messageSchema.index({ userId: 1, isUser: 1, createdAt: -1 }); // User vs AI messages
messageSchema.index({ sessionId: 1, readAt: 1 }); // Unread message queries
messageSchema.index({ sessionId: 1, createdAt: -1, _id: -1 }); // Cursor-based pagination

module.exports = mongoose.model('Message', messageSchema);
