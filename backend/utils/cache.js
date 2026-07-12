/**
 * In-memory LRU cache with TTL support for frequently accessed data.
 * Used to reduce database load for repeated queries.
 */
class MemoryCache {
  constructor(ttlSeconds = 300) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
    this.maxSize = 100; // Max cache entries
  }

  /**
   * Get a value from cache. Returns null if not found or expired.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU tracking) - delete and re-set
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  /**
   * Set a value in cache with optional custom TTL.
   */
  set(key, data, customTtl = null) {
    // Enforce max size - delete oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + (customTtl || this.ttl),
    });
  }

  /**
   * Delete a key from cache.
   */
  del(key) {
    this.cache.delete(key);
  }

  /**
   * Flush entire cache.
   */
  flush() {
    this.cache.clear();
  }

  /**
   * Get cache stats.
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl / 1000,
    };
  }
}

// Singleton instance
const cache = new MemoryCache();

// Express middleware to cache GET responses
function cacheMiddleware(durationSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__cache__${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Store original res.json to intercept
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, durationSeconds * 1000);
      }
      originalJson(body);
    };

    next();
  };
}

// Cache key helpers
function buildUserCacheKey(userId) {
  return `user:${userId}`;
}

function buildSessionCacheKey(sessionId) {
  return `session:${sessionId}`;
}

function buildMessagesCacheKey(sessionId, page, limit) {
  return `messages:${sessionId}:${page}:${limit}`;
}

module.exports = {
  cache,
  cacheMiddleware,
  buildUserCacheKey,
  buildSessionCacheKey,
  buildMessagesCacheKey,
};
