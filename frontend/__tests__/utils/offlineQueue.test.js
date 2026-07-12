import {
  addToQueue,
  getQueue,
  removeFromQueue,
  clearQueue,
  hasPendingMessages,
  retryQueue,
} from '../../utils/offlineQueue';

const STORAGE_KEY = 'brainbytes_offline_queue';

describe('offlineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('addToQueue', () => {
    test('adds a message to empty queue', () => {
      addToQueue({ text: 'Hello', subject: 'math' });

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].text).toBe('Hello');
      expect(queue[0].subject).toBe('math');
      expect(queue[0]._queuedAt).toBeDefined();
      expect(queue[0]._retryCount).toBe(0);
    });

    test('appends to existing queue', () => {
      addToQueue({ text: 'First' });
      addToQueue({ text: 'Second' });

      const queue = getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].text).toBe('First');
      expect(queue[1].text).toBe('Second');
    });

    test('preserves existing message properties', () => {
      addToQueue({ _id: '123', text: 'Test', customField: true });

      const queue = getQueue();
      expect(queue[0]._id).toBe('123');
      expect(queue[0].customField).toBe(true);
    });

    test('handles localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceeded');
      });

      addToQueue({ text: 'Test' });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save message to offline queue:',
        expect.any(Error),
      );

      Storage.prototype.setItem = origSetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('getQueue', () => {
    test('returns empty array when no queue exists', () => {
      expect(getQueue()).toEqual([]);
    });

    test('returns parsed queue from localStorage', () => {
      const messages = [{ _id: '1', text: 'Test' }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));

      expect(getQueue()).toEqual(messages);
    });

    test('returns empty array on corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json{{{');

      expect(getQueue()).toEqual([]);
    });
  });

  describe('removeFromQueue', () => {
    test('removes message by id', () => {
      addToQueue({ _id: '1', text: 'First' });
      addToQueue({ _id: '2', text: 'Second' });
      addToQueue({ _id: '3', text: 'Third' });

      removeFromQueue('2');

      const queue = getQueue();
      expect(queue).toHaveLength(2);
      expect(queue.map((m) => m._id)).toEqual(['1', '3']);
    });

    test('does nothing when id not found', () => {
      addToQueue({ _id: '1', text: 'First' });

      removeFromQueue('nonexistent');

      expect(getQueue()).toHaveLength(1);
    });

    test('handles empty queue', () => {
      expect(() => removeFromQueue('1')).not.toThrow();
    });
  });

  describe('clearQueue', () => {
    test('removes all messages', () => {
      addToQueue({ text: 'A' });
      addToQueue({ text: 'B' });
      addToQueue({ text: 'C' });

      clearQueue();

      expect(getQueue()).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    test('handles empty queue', () => {
      expect(() => clearQueue()).not.toThrow();
    });
  });

  describe('hasPendingMessages', () => {
    test('returns false when queue is empty', () => {
      expect(hasPendingMessages()).toBe(false);
    });

    test('returns true when messages exist', () => {
      addToQueue({ text: 'Test' });

      expect(hasPendingMessages()).toBe(true);
    });

    test('returns false after clearQueue', () => {
      addToQueue({ text: 'Test' });
      clearQueue();

      expect(hasPendingMessages()).toBe(false);
    });
  });

  describe('retryQueue', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: false });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('returns 0 when queue is empty', async () => {
      const sendFn = jest.fn();
      const sent = await retryQueue(sendFn);

      expect(sent).toBe(0);
      expect(sendFn).not.toHaveBeenCalled();
    });

    test('calls sendFn for each message and returns success count', async () => {
      const sendFn = jest.fn().mockResolvedValue(true);
      addToQueue({ _id: '1', text: 'A' });
      addToQueue({ _id: '2', text: 'B' });
      addToQueue({ _id: '3', text: 'C' });

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      const sent = await promise;

      expect(sent).toBe(3);
      expect(sendFn).toHaveBeenCalledTimes(3);
      expect(sendFn).toHaveBeenCalledWith(expect.objectContaining({ _id: '1' }));
      expect(sendFn).toHaveBeenCalledWith(expect.objectContaining({ _id: '2' }));
      expect(sendFn).toHaveBeenCalledWith(expect.objectContaining({ _id: '3' }));
      expect(getQueue()).toHaveLength(0);
    });

    test('removes successfully sent messages from queue', async () => {
      const sendFn = jest.fn().mockResolvedValue(true);
      addToQueue({ _id: '1', text: 'A' });
      addToQueue({ _id: '2', text: 'B' });

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      await promise;

      expect(getQueue()).toHaveLength(0);
    });

    test('increments retry count on sendFn returning false', async () => {
      const sendFn = jest.fn().mockResolvedValue(false);
      addToQueue({ _id: '1', text: 'Test' });

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      await promise;

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]._retryCount).toBe(1);
    });

    test('increments retry count on thrown error', async () => {
      const sendFn = jest.fn().mockRejectedValue(new Error('Network error'));
      addToQueue({ _id: '1', text: 'Test' });

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      await promise;

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]._retryCount).toBe(1);
    });

    test('removes messages when retryCount >= maxRetries', async () => {
      const sendFn = jest.fn().mockResolvedValue(false);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ _id: '1', text: 'Test', _queuedAt: Date.now(), _retryCount: 5 }]),
      );

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      await promise;

      expect(getQueue()).toHaveLength(0);
    });

    test('respects custom maxRetries option', async () => {
      const sendFn = jest.fn().mockResolvedValue(false);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ _id: '1', text: 'Test', _queuedAt: Date.now(), _retryCount: 3 }]),
      );

      const promise = retryQueue(sendFn, { maxRetries: 3 });
      await jest.runAllTimersAsync();
      await promise;

      expect(getQueue()).toHaveLength(0);
    });

    test('uses correct delay based on retryCount', async () => {
      const sendFn = jest.fn().mockResolvedValue(true);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ _id: '1', text: 'Test', _queuedAt: Date.now(), _retryCount: 0 }]),
      );

      const promise = retryQueue(sendFn);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      await jest.runAllTimersAsync();
      await promise;
      setTimeoutSpy.mockRestore();
    });

    test('caps delay at 16 seconds', async () => {
      const sendFn = jest.fn().mockResolvedValue(true);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // _retryCount 4 => delay = min(1000 * 2^4, 16000) = 16000 (capped)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ _id: '1', text: 'Test', _queuedAt: Date.now(), _retryCount: 4 }]),
      );

      const promise = retryQueue(sendFn);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 16000);

      await jest.runAllTimersAsync();
      await promise;
      setTimeoutSpy.mockRestore();
    });

    test('partially succeeds with mix of success and failure', async () => {
      const sendFn = jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      addToQueue({ _id: '1', text: 'A' });
      addToQueue({ _id: '2', text: 'B' });
      addToQueue({ _id: '3', text: 'C' });

      const promise = retryQueue(sendFn);
      await jest.runAllTimersAsync();
      const sent = await promise;

      expect(sent).toBe(2);
      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]._id).toBe('2');
    });
  });
});
