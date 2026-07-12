const express = require('express');
const router = express.Router();
const LearningMaterial = require('../models/LearningMaterial');

// Create a new learning material
router.post('/', async (req, res) => {
  try {
    const { subject, topic, content, difficulty, tags, createdBy } = req.body;

    const material = new LearningMaterial({
      subject,
      topic,
      content,
      difficulty,
      tags,
      createdBy,
    });

    await material.save();

    res.status(201).json({
      message: 'Learning material created successfully',
      material,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server error while creating learning material' });
  }
});

// Get all learning materials with optional filtering
router.get('/', async (req, res) => {
  try {
    const { subject, difficulty, search, page = 1, limit = 10 } = req.query;

    const query = {};

    if (subject) {
      query.subject = subject;
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [materials, total] = await Promise.all([
      LearningMaterial.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LearningMaterial.countDocuments(query),
    ]);

    res.json({
      materials,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching learning materials' });
  }
});

// Get a single learning material by ID
router.get('/:id', async (req, res) => {
  try {
    const material = await LearningMaterial.findById(req.params.id).populate(
      'createdBy',
      'name email',
    );

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    res.json(material);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid material ID format' });
    }
    res.status(500).json({ error: 'Server error while fetching learning material' });
  }
});

// Update a learning material
router.put('/:id', async (req, res) => {
  try {
    const { subject, topic, content, difficulty, tags } = req.body;

    const material = await LearningMaterial.findByIdAndUpdate(
      req.params.id,
      { subject, topic, content, difficulty, tags, updatedAt: Date.now() },
      { new: true, runValidators: true },
    );

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    res.json({
      message: 'Learning material updated successfully',
      material,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid material ID format' });
    }
    res.status(500).json({ error: 'Server error while updating learning material' });
  }
});

// Delete a learning material
router.delete('/:id', async (req, res) => {
  try {
    const material = await LearningMaterial.findByIdAndDelete(req.params.id);

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    res.json({ message: 'Learning material deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid material ID format' });
    }
    res.status(500).json({ error: 'Server error while deleting learning material' });
  }
});

module.exports = router;
