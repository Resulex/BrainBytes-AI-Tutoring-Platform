const express = require('express');
const router = express.Router();
const UserPreference = require('../models/UserPreference');
const { authenticate } = require('../middleware/auth');

// GET /api/preferences - Get current user's preferences
router.get('/', authenticate, async (req, res) => {
  try {
    const preferences = await UserPreference.findOne({ userId: req.user._id });

    // Return defaults if no preferences exist yet
    if (!preferences) {
      return res.json({
        preferences: {
          theme: 'light',
          fontSize: 'medium',
          language: 'en',
          notifications: { email: false, sound: true },
          chatSettings: { showTimestamps: true, enterToSend: true, followUpSuggestions: true },
        },
      });
    }

    res.json({ preferences });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching preferences.' });
  }
});

// PUT /api/preferences - Create or update preferences
router.put('/', authenticate, async (req, res) => {
  try {
    const allowedFields = ['theme', 'fontSize', 'language', 'notifications', 'chatSettings'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    updates.updatedAt = Date.now();

    const preferences = await UserPreference.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, upsert: true, runValidators: true },
    );

    res.json({
      message: 'Preferences updated successfully.',
      preferences,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server error updating preferences.' });
  }
});

module.exports = router;
