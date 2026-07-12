const STORAGE_KEY = 'brainbytes_offline_queue';

/**
 * Save a failed message to the offline queue
 */
export function addToQueue(message) {
  try {
    const queue = getQueue();
    queue.push({
      ...message,
      _queuedAt: Date.now(),
      _retryCount: 0,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save message to offline queue:', err);
  }
}

/**
 * Get all queued messages
 */
export function getQueue() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a message from the queue by id
 */
export function removeFromQueue(id) {
  try {
    const queue = getQueue().filter((msg) => msg._id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to remove from offline queue:', err);
  }
}

/**
 * Clear the entire queue
 */
export function clearQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline queue:', err);
  }
}

/**
 * Retry sending all queued messages with exponential backoff
 * @param {Function} sendFn - Async function to send a message (returns true on success)
 * @param {Object} options
 * @param {number} options.maxRetries - Max retry attempts per message
 * @returns {Promise<number>} Number of successfully sent messages
 */
export async function retryQueue(sendFn, { maxRetries = 5 } = {}) {
  const queue = getQueue();
  if (queue.length === 0) {
    return 0;
  }

  let sent = 0;

  for (const msg of queue) {
    if (msg._retryCount >= maxRetries) {
      removeFromQueue(msg._id);
      continue;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, msg._retryCount), 16000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const success = await sendFn(msg);
      if (success) {
        removeFromQueue(msg._id);
        sent++;
      } else {
        // Update retry count
        msg._retryCount++;
        const updatedQueue = getQueue().map((m) => (m._id === msg._id ? msg : m));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
      }
    } catch {
      msg._retryCount++;
      const updatedQueue = getQueue().map((m) => (m._id === msg._id ? msg : m));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
    }
  }

  return sent;
}

/**
 * Check if there are pending messages in the queue
 */
export function hasPendingMessages() {
  return getQueue().length > 0;
}
