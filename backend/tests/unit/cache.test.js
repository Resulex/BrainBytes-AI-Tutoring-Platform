const {
  cache,
  buildUserCacheKey,
  buildSessionCacheKey,
  buildMessagesCacheKey,
} = require('../../utils/cache');

describe('MemoryCache (via singleton)', () => {
  beforeEach(() => {
    cache.flush();
    jest.clearAllMocks();
  });

  describe('get and set', () => {
    test('returns null for non-existent key', () => {
      expect(cache.get('missing')).toBeNull();
    });

    test('sets and retrieves a value', () => {
      cache.set('key1', { value: 42 });
      expect(cache.get('key1')).toEqual({ value: 42 });
    });

    test('returns null for expired entry', () => {
      jest.useFakeTimers();
      cache.set('key1', 'data', 1000); // 1 second TTL

      jest.advanceTimersByTime(2000);
      expect(cache.get('key1')).toBeNull();
      jest.useRealTimers();
    });

    test('uses default TTL when no custom TTL provided', () => {
      jest.useFakeTimers();
      cache.flush(); // clear first
      cache.set('key1', 'data'); // uses default 300s TTL

      jest.advanceTimersByTime(1000); // 1 second — still valid
      expect(cache.get('key1')).toBe('data');

      // The default TTL is 300000ms (5 minutes), so the entry is still valid
      jest.useRealTimers();
    });

    test('overwrites existing key', () => {
      cache.set('key1', 'old');
      cache.set('key1', 'new');
      expect(cache.get('key1')).toBe('new');
    });

    test('stores complex objects', () => {
      const obj = { nested: { deep: [1, 2, 3] }, fn: 'test' };
      cache.set('complex', obj);
      expect(cache.get('complex')).toEqual(obj);
    });

    test('stores null and false values', () => {
      cache.set('nullVal', null);
      cache.set('falseVal', false);
      cache.set('zeroVal', 0);
      expect(cache.get('nullVal')).toBeNull();
      expect(cache.get('falseVal')).toBe(false);
      expect(cache.get('zeroVal')).toBe(0);
    });

    test('LRU: get moves entry to end (most recently used)', () => {
      // Fill cache close to maxSize with unique keys
      for (let i = 0; i < 99; i++) {
        cache.set(`key${i}`, `val${i}`);
      }

      // Now force maxSize by adding the 100th entry
      cache.set('key99', 'val99');

      // Access key0 (the oldest entry, now at pos 0 in Map)
      cache.get('key0');

      // Add one more — should evict key1 (now oldest, since key0 was re-accessed)
      cache.set('key100', 'val100');

      expect(cache.get('key0')).toBe('val0'); // key0 survived (was re-accessed)
      expect(cache.get('key1')).toBeNull(); // key1 was evicted
      expect(cache.get('key100')).toBe('val100');
    });

    test('evicts oldest entry when maxSize exceeded', () => {
      // Fill to 100 entries
      for (let i = 0; i < 100; i++) {
        cache.set(`fill${i}`, `v${i}`);
      }

      // Now add one more — should evict fill0
      cache.set('overflow', 'overflow-val');

      expect(cache.get('fill0')).toBeNull(); // oldest was evicted
      expect(cache.get('fill99')).toBe('v99'); // last of original still there
      expect(cache.get('overflow')).toBe('overflow-val');
    });
  });

  describe('del', () => {
    test('removes a key', () => {
      cache.set('key1', 'val1');
      cache.del('key1');
      expect(cache.get('key1')).toBeNull();
    });

    test('does nothing for non-existent key', () => {
      expect(() => cache.del('missing')).not.toThrow();
    });
  });

  describe('flush', () => {
    test('clears all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.flush();

      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBeNull();
    });

    test('does nothing on empty cache', () => {
      expect(() => cache.flush()).not.toThrow();
    });
  });

  describe('stats', () => {
    test('returns stats for empty cache', () => {
      const s = cache.stats();
      expect(s.size).toBe(0);
      expect(s.maxSize).toBe(100);
      expect(s.ttl).toBe(300);
    });

    test('returns correct size after adding entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      const s = cache.stats();
      expect(s.size).toBe(3);
    });

    test('reflects size after deletions', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.del('a');

      expect(cache.stats().size).toBe(1);
    });
  });
});

describe('cache key helpers', () => {
  test('buildUserCacheKey', () => {
    expect(buildUserCacheKey('abc123')).toBe('user:abc123');
    expect(buildUserCacheKey('')).toBe('user:');
  });

  test('buildSessionCacheKey', () => {
    expect(buildSessionCacheKey('sess-456')).toBe('session:sess-456');
  });

  test('buildMessagesCacheKey', () => {
    expect(buildMessagesCacheKey('sess-1', 1, 50)).toBe('messages:sess-1:1:50');
    expect(buildMessagesCacheKey('sess-1', 3, 100)).toBe('messages:sess-1:3:100');
  });
});
