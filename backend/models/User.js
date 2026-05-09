const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  preferredSubjects: {
    type: [String],
    default: [],
    enum: {
      values: ['Mathematics', 'Science', 'English', 'History', 'Filipino', 'Computer Science', 'Other'],
      message: '{VALUE} is not a supported subject'
    },  
  },
  bio: {   //short biography
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
    },
    avatarUrl: { // profile picture URL
      type: String,
      default: ''
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

// Update the updatedAt timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);