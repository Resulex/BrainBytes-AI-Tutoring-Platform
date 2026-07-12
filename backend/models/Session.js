const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  subject: {
    type: String,
    enum: ['math', 'science', 'history', 'general', ''],
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  deviceInfo: {
    type: String,
    default: '',
  },
  ipAddress: {
    type: String,
    default: '',
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
});

sessionSchema.index({ userId: 1, lastActivity: -1 });
sessionSchema.index({ isActive: 1, lastActivity: 1 });

// Update lastActivity on save
sessionSchema.pre('save', function (next) {
  this.lastActivity = Date.now();
  next();
});

module.exports = mongoose.model('Session', sessionSchema);
