const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light',
  },
  fontSize: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium',
  },
  language: {
    type: String,
    enum: ['en', 'fil', 'tl'],
    default: 'en',
  },
  notifications: {
    email: { type: Boolean, default: false },
    sound: { type: Boolean, default: true },
  },
  chatSettings: {
    showTimestamps: { type: Boolean, default: true },
    enterToSend: { type: Boolean, default: true },
    followUpSuggestions: { type: Boolean, default: true },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userPreferenceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
