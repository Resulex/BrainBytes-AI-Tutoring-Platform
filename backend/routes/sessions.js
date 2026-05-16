const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Message = require('../models/Message');
const { authenticate, optionalAuth } = require('../middleware/auth');

// POST /api/sessions - Create a new chat session
router.post('/', optionalAuth, async (req, res) => {
  try {
    const session = new Session({
      userId: req.user ? req.user._id : null,
      subject: req.body.subject || '',
      deviceInfo: req.headers['user-agent'] || '',
      ipAddress: req.ip || ''
    });
    await session.save();
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ error: 'Server error creating session.' });
  }
});

// GET /api/sessions - List sessions for a user (or anonymous)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const query = {};

    if (req.user) {
      query.userId = req.user._id;
    } else {
      query.userId = null;
    }

    if (active === 'true') query.isActive = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Session.countDocuments(query)
    ]);

    res.json({
      sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching sessions.' });
  }
});

// GET /api/sessions/:id - Get session with messages
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const messages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: 1 });

    res.json({ session, messages });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid session ID format.' });
    }
    res.status(500).json({ error: 'Server error fetching session.' });
  }
});

// PUT /api/sessions/:id - Update session (change subject, end session)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updates = {};
    if (req.body.subject) updates.subject = req.body.subject;
    if (req.body.isActive === false) {
      updates.isActive = false;
      updates.endedAt = Date.now();
    }

    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { ...updates, lastActivity: Date.now() },
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    res.json({ session });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid session ID format.' });
    }
    res.status(500).json({ error: 'Server error updating session.' });
  }
});

module.exports = router;
