const mongoose = require('mongoose');

const learningMaterialSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    enum: {
      values: ['Mathematics', 'Science', 'English', 'History', 'Filipino', 'Computer Science'],
      message: '{VALUE} is not a supported subject',
    },
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    minlength: [3, 'Topic must be at least 3 characters'],
    maxlength: [200, 'Topic cannot exceed 200 characters'],
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    minlength: [10, 'Content must be at least 10 characters'],
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  tags: {
    type: [String],
    default: [],
  },
  references: [
    {
      //list of external links
      title: String,
      url: String,
    },
  ],
  isPublished: {
    // draft/published status
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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

// Update timestamp before saving
learningMaterialSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Text index for full-text search on topic, content, and tags
learningMaterialSchema.index({ topic: 'text', content: 'text', tags: 'text' });

// Compound indexes for filtered queries
learningMaterialSchema.index({ subject: 1, topic: 1 }); // Subject browsing
learningMaterialSchema.index({ subject: 1, difficulty: 1, isPublished: 1 }); // Filtered listings
learningMaterialSchema.index({ createdBy: 1, createdAt: -1 }); // User's materials
learningMaterialSchema.index({ tags: 1 }); // Tag-based queries
learningMaterialSchema.index({ isPublished: 1, createdAt: -1 }); // Published materials feed

module.exports = mongoose.model('LearningMaterial', learningMaterialSchema);
