import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../context/AuthContext';

// Mock socket.io-client
jest.mock('socket.io-client');
const { io } = require('socket.io-client');

// Also need to mock axios for AuthProvider's verifyToken call
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { user: { name: 'Test' } } })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  defaults: { headers: { common: {} } },
}));

// The mockSocket is created in the mock
const mockSocket = io();

// Need to re-import useSocket dynamically so the mock is applied
let useSocket;
beforeAll(() => {
  useSocket = require('../../hooks/useSocket').default;
});

// Wrapper with AuthProvider (which provides token to useSocket)
function wrapper({ children }) {
  // Set up localStorage with a token so useSocket has auth
  localStorage.setItem('brainbytes_token', 'test-jwt-token');
  return React.createElement(AuthProvider, null, children);
}

describe('useSocket', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('brainbytes_token', 'test-jwt-token');
    localStorage.setItem('brainbytes_user', JSON.stringify({ name: 'Test' }));
    jest.clearAllMocks();
  });

  describe('connection lifecycle', () => {
    test('creates socket connection on mount', async () => {
      // AuthProvider reads token async, so we await the last io() call
      renderHook(() => useSocket(null), { wrapper });

      await waitFor(
        () => {
          const lastCall = io.mock.calls[io.mock.calls.length - 1];
          expect(lastCall[1].auth.token).toBe('test-jwt-token');
        },
        { timeout: 3000 },
      );
    });

    test('sets isConnected to true on connect event', async () => {
      const { result } = renderHook(() => useSocket(null), { wrapper });

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];

      act(() => {
        connectHandler();
      });

      expect(result.current.isConnected).toBe(true);
    });

    test('sets isConnected to false on disconnect', async () => {
      const { result } = renderHook(() => useSocket(null), { wrapper });

      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      act(() => connectHandler());
      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect',
      )[1];
      act(() => {
        disconnectHandler('transport close');
      });

      expect(result.current.isConnected).toBe(false);
    });

    test('sets isConnected to false on connect_error', async () => {
      const { result } = renderHook(() => useSocket(null), { wrapper });

      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error',
      )[1];
      act(() => {
        errorHandler(new Error('Connection refused'));
      });

      expect(result.current.isConnected).toBe(false);
    });

    test('disconnects socket on unmount', () => {
      const { unmount } = renderHook(() => useSocket(null), { wrapper });

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    test('emits session:join when connected and sessionId exists', () => {
      mockSocket.connected = true;

      renderHook(() => useSocket('session-123'), { wrapper });

      // Find connect handler and fire it
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      act(() => connectHandler());

      expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId: 'session-123',
      });
    });

    test('rejoins session when sessionId changes while connected', () => {
      mockSocket.connected = true;

      const { rerender } = renderHook(
        ({ sessionId }) => useSocket(sessionId),
        {
          initialProps: { sessionId: 'session-1' },
          wrapper,
        },
      );

      // Trigger connect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      act(() => connectHandler());

      // Clear emit calls
      mockSocket.emit.mockClear();

      // Change sessionId
      rerender({ sessionId: 'session-2' });

      expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId: 'session-2',
      });
    });

    test('does not emit session:join without sessionId', () => {
      mockSocket.connected = true;

      renderHook(() => useSocket(null), { wrapper });

      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      act(() => connectHandler());

      // session:join should not have been called
      const sessionJoinCalls = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'session:join',
      );
      expect(sessionJoinCalls).toHaveLength(0);
    });
  });

  describe('onlineCount', () => {
    test('updates onlineCount from server event', () => {
      const { result } = renderHook(() => useSocket(null), { wrapper });

      const countHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'user:onlineCount',
      )[1];
      act(() => {
        countHandler({ count: 42 });
      });

      expect(result.current.onlineCount).toBe(42);
    });
  });

  describe('emit functions', () => {
    test('emitTyping sends typing event when connected', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      act(() => {
        result.current.emitTyping(true);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:typing', {
        isTyping: true,
        sessionId: 'session-1',
      });
    });

    test('emitTyping does nothing when disconnected', () => {
      mockSocket.connected = false;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      act(() => {
        result.current.emitTyping(true);
      });

      // emit may have been called for other events, but not for chat:typing
      const typingCalls = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'chat:typing',
      );
      expect(typingCalls).toHaveLength(0);
    });

    test('emitReadReceipt sends read receipt with message IDs', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      act(() => {
        result.current.emitReadReceipt(['msg-1', 'msg-2', 'msg-3']);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:readReceipt', {
        messageIds: ['msg-1', 'msg-2', 'msg-3'],
        sessionId: 'session-1',
      });
    });

    test('emitReadReceipt does nothing with empty array', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      act(() => {
        result.current.emitReadReceipt([]);
      });

      const receiptCalls = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'chat:readReceipt',
      );
      expect(receiptCalls).toHaveLength(0);
    });

    test('emitMessage sends message and returns true when connected', () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      let success;
      act(() => {
        success = result.current.emitMessage('Hello world', 'science');
      });

      expect(success).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', {
        text: 'Hello world',
        subject: 'science',
        sessionId: 'session-1',
      });
    });

    test('emitMessage returns false when disconnected', () => {
      mockSocket.connected = false;
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      let success;
      act(() => {
        success = result.current.emitMessage('Hello world', 'science');
      });

      expect(success).toBe(false);
    });

    test('emitMessage does not call socket.emit when disconnected', () => {
      mockSocket.connected = false;
      mockSocket.emit.mockClear();
      const { result } = renderHook(() => useSocket('session-1'), { wrapper });

      act(() => {
        result.current.emitMessage('Hello world', 'science');
      });

      const messageCalls = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'chat:message',
      );
      expect(messageCalls).toHaveLength(0);
    });
  });

  describe('token change', () => {
  describe('token change', () => {
    test('uses token from AuthProvider in socket auth', async () => {
      // Rerender with same token — verify the socket receives it
      renderHook(() => useSocket(null), { wrapper });

      // The token comes from AuthProvider which reads localStorage.
      // Since we set 'test-jwt-token', eventually io() should be called with it.
      await waitFor(
        () => {
          const calls = io.mock.calls;
          const hasTokenCall = calls.some((call) => call[1].auth.token === 'test-jwt-token');
          expect(hasTokenCall).toBe(true);
        },
        { timeout: 3000 },
      );
    });
  });
  });
});
