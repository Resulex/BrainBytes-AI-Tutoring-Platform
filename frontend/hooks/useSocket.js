import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function useSocket(sessionId) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: { token: token || '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);

      // Join session room
      if (sessionId) {
        socket.emit('session:join', { sessionId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    socket.on('user:onlineCount', (data) => {
      setOnlineCount(data.count);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, sessionId]);

  // Rejoin session if sessionId changes
  useEffect(() => {
    if (socketRef.current?.connected && sessionId) {
      socketRef.current.emit('session:join', { sessionId });
    }
  }, [sessionId]);

  const emitTyping = useCallback((isTyping) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:typing', { isTyping, sessionId });
    }
  }, [sessionId]);

  const emitReadReceipt = useCallback((messageIds) => {
    if (socketRef.current?.connected && messageIds.length > 0) {
      socketRef.current.emit('chat:readReceipt', { messageIds, sessionId });
    }
  }, [sessionId]);

  const emitMessage = useCallback((text, subject) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', { text, subject, sessionId });
      return true;
    }
    return false;
  }, [sessionId]);

  const socket = socketRef.current;

  return {
    socket,
    isConnected,
    onlineCount,
    emitTyping,
    emitReadReceipt,
    emitMessage
  };
}
