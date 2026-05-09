const mongoose = require('mongoose');

const learningMaterialSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    enum: {
      values: ['Mathematics', 'Science', 'English', 'History', 'Filipino', 'Computer Science'],
      message: '{VALUE} is not a supported subject'
    }
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    minlength: [3, 'Topic must be at least 3 characters'],
    maxlength: [200, 'Topic cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    minlength: [10, 'Content must be at least 10 characters']
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  tags: {
    type: [String],
    default: []
  },
  references: [{              //list of external links
    title: String,
    url: String
  }],
  isPublished: {              // draft/published status
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
learningMaterialSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Text index for search functionality
learningMaterialSchema.index({ subject: 1, topic: 1 });
learningMaterialSchema.index({ tags: 1 });

module.exports = mongoose.model('LearningMaterial', learningMaterialSchema);