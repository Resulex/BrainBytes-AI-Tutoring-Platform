/**
 * Input validation middleware for API endpoints.
 * Provides schema-based validation for request bodies.
 */

// Validation rules
const validators = {
  // Auth
  register: (body) => {
    const errors = [];
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters.');
    }
    if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) {
      errors.push('A valid email address is required.');
    }
    if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
      errors.push('Password must be at least 6 characters.');
    }
    return errors;
  },

  login: (body) => {
    const errors = [];
    if (!body.email) errors.push('Email is required.');
    if (!body.password) errors.push('Password is required.');
    return errors;
  },

  // Messages
  message: (body) => {
    const errors = [];
    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
      errors.push('Message text is required.');
    }
    if (body.text && body.text.length > 5000) {
      errors.push('Message cannot exceed 5000 characters.');
    }
    if (body.subject && !['math', 'science', 'history', 'general', ''].includes(body.subject)) {
      errors.push('Subject must be one of: math, science, history, general.');
    }
    return errors;
  },

  // Users
  userCreate: (body) => {
    const errors = [];
    if (!body.name || body.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters.');
    }
    if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) {
      errors.push('A valid email address is required.');
    }
    if (body.preferredSubjects && !Array.isArray(body.preferredSubjects)) {
      errors.push('Preferred subjects must be an array.');
    }
    return errors;
  },

  userUpdate: (body) => {
    const errors = [];
    if (body.name !== undefined && body.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters.');
    }
    if (body.email !== undefined && !/^\S+@\S+\.\S+$/.test(body.email)) {
      errors.push('A valid email address is required.');
    }
    if (body.preferredSubjects !== undefined && !Array.isArray(body.preferredSubjects)) {
      errors.push('Preferred subjects must be an array.');
    }
    return errors;
  },

  // Sessions
  sessionCreate: (body) => {
    const errors = [];
    if (body.subject && !['math', 'science', 'history', 'general', ''].includes(body.subject)) {
      errors.push('Subject must be one of: math, science, history, general.');
    }
    return errors;
  },

  // Preferences
  preferences: (body) => {
    const errors = [];
    if (body.theme && !['light', 'dark', 'auto'].includes(body.theme)) {
      errors.push('Theme must be: light, dark, or auto.');
    }
    if (body.fontSize && !['small', 'medium', 'large'].includes(body.fontSize)) {
      errors.push('Font size must be: small, medium, or large.');
    }
    if (body.language && !['en', 'fil', 'tl'].includes(body.language)) {
      errors.push('Language must be: en, fil, or tl.');
    }
    return errors;
  },

  // Learning Materials
  learningMaterial: (body) => {
    const errors = [];
    if (!body.subject) errors.push('Subject is required.');
    if (!body.topic || body.topic.length < 3) errors.push('Topic must be at least 3 characters.');
    if (!body.content || body.content.length < 10) errors.push('Content must be at least 10 characters.');
    if (body.difficulty && !['beginner', 'intermediate', 'advanced'].includes(body.difficulty)) {
      errors.push('Difficulty must be: beginner, intermediate, or advanced.');
    }
    return errors;
  }
};

/**
 * Middleware factory - returns Express middleware for a given validation schema.
 * Usage: router.post('/messages', validate('message'), handler)
 */
function validate(schemaName) {
  return (req, res, next) => {
    const validator = validators[schemaName];
    if (!validator) {
      console.error(`Unknown validation schema: ${schemaName}`);
      return next();
    }

    const errors = validator(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: errors
      });
    }

    next();
  };
}

/**
 * Sanitize string inputs - trim and strip dangerous characters.
 */
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Sanitize all string fields in an object recursively.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitize(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

module.exports = {
  validate,
  sanitize,
  sanitizeObject,
  validators
};
