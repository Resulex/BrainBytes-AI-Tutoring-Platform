import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { addToQueue, retryQueue, hasPendingMessages } from '../utils/offlineQueue';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function LoginForm({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authCard}>
        <h1 style={styles.authTitle}>Welcome to BrainBytes</h1>
        <p style={styles.authSubtitle}>Sign in to continue learning</p>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={styles.authInput} />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            style={styles.authInput} />
          <button type="submit" disabled={loading} style={styles.authButton}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={styles.switchText}>
          Don't have an account?{' '}
          <button onClick={onSwitch} style={styles.switchButton}>Create one</button>
        </p>
      </div>
    </div>
  );
}

function RegisterForm({ onRegister, onSwitch }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onRegister(name, email, password, []);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authCard}>
        <h1 style={styles.authTitle}>Create Account</h1>
        <p style={styles.authSubtitle}>Join BrainBytes AI Tutor</p>
        {error && <div style={styles.errorBanner}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full Name" value={name}
            onChange={e => setName(e.target.value)} required style={styles.authInput} />
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required style={styles.authInput} />
          <input type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            style={styles.authInput} />
          <button type="submit" disabled={loading} style={styles.authButton}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p style={styles.switchText}>
          Already have an account?{' '}
          <button onClick={onSwitch} style={styles.switchButton}>Sign in</button>
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message, onVisible, onSuggestionClick }) {
  const msgRef = useRef(null);

  useEffect(() => {
    if (!message.isUser && !message.readAt && onVisible && msgRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            onVisible(message._id);
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(msgRef.current);
      return () => observer.disconnect();
    }
  }, [message._id, message.isUser, message.readAt, onVisible]);

  const renderText = (text) => {
    if (!text) return '';
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g,
      '<code style="background:#f0f0f0;padding:2px 5px;border-radius:3px;font-size:0.9em">$1</code>');
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g,
      '<pre style="background:#1e1e2e;color:#cdd6f4;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:8px 0"><code>$2</code></pre>');
    html = html.replace(/^\s*[\-\*]\s(.+)$/gm,
      '<li style="margin:3px 0">$1</li>');
    html = html.replace(/(<li[\s\S]*?<\/li>)/g,
      '<ul style="margin:6px 0;padding-left:24px">$1</ul>');
    html = html.replace(/\n/g, '<br>');
    return html;
  };

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div ref={msgRef} className="message-bubble" style={{
      ...styles.messageBubble,
      backgroundColor: message.isUser ? '#e3f2fd' : '#e8f5e9',
      marginLeft: message.isUser ? 'auto' : '0',
      marginRight: message.isUser ? '0' : 'auto',
      borderBottomRightRadius: message.isUser ? '4px' : '12px',
      borderBottomLeftRadius: message.isUser ? '12px' : '4px',
    }}>
      <div style={{ lineHeight: '1.6', fontSize: '15px' }}
        dangerouslySetInnerHTML={{ __html: renderText(message.text) }} />
      <div style={styles.messageMeta}>
        <span>{message.isUser ? 'You' : 'AI Tutor'} • {time}</span>
        {!message.isUser && (
          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4caf50' }}>
            {message.readAt ? '✓✓ Read' : '✓ Delivered'}
          </span>
        )}
      </div>
      {!message.isUser && message.followUps && message.followUps.length > 0 && (
        <div style={styles.followUps}>
          {message.followUps.map((q, i) => (
            <span key={i} style={styles.followUpChip}
              onClick={() => onSuggestionClick && onSuggestionClick(q)}>{q}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated, login, register, logout, loading: authLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [userIsTyping, setUserIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);
  const readReceiptQueue = useRef(new Set());

  const { socket, isConnected, emitTyping, emitReadReceipt, emitMessage } = useSocket(sessionId);

  // Session management
  useEffect(() => {
    if (isAuthenticated) {
      const storedSession = sessionStorage.getItem('brainbytes_session');
      if (storedSession) {
        setSessionId(storedSession);
      } else {
        axios.post(`${API_URL}/api/sessions`)
          .then(res => {
            const sid = res.data.session._id;
            setSessionId(sid);
            sessionStorage.setItem('brainbytes_session', sid);
          })
          .catch(console.error);
      }
    }
  }, [isAuthenticated]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const url = sessionId
        ? `${API_URL}/api/messages?sessionId=${sessionId}&limit=100`
        : `${API_URL}/api/messages?limit=100`;
      const response = await axios.get(url);
      setMessages(response.data.messages || response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isAuthenticated && sessionId) {
      fetchMessages();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [isAuthenticated, sessionId, fetchMessages, authLoading]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (data) => {
      setMessages(prev => [...prev, data.message]);
      if (data.type === 'ai') setIsAiTyping(false);
    };
    const handleTyping = (data) => {
      if (data.userId === 'ai') setIsAiTyping(data.isTyping);
    };
    const handleError = (data) => {
      setMessages(prev => [...prev, {
        _id: Date.now().toString(), text: data.message || "Sorry, I couldn't process your request.",
        isUser: false, createdAt: new Date().toISOString()
      }]);
      setIsAiTyping(false);
    };
    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:error', handleError);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:error', handleError);
    };
  }, [socket]);

  // Offline detection
  useEffect(() => { setIsOffline(!isConnected); }, [isConnected]);

  // Retry offline queue on reconnect
  useEffect(() => {
    if (isConnected && hasPendingMessages()) {
      retryQueue(async (msg) => (socket && msg.text) ? emitMessage(msg.text, msg.subject) : false);
    }
  }, [isConnected, socket, emitMessage]);

  // Read receipts (batch via IntersectionObserver)
  const handleMessageVisible = useCallback((messageId) => {
    readReceiptQueue.current.add(messageId);
    if (!window._readReceiptTimer) {
      window._readReceiptTimer = setTimeout(() => {
        const ids = [...readReceiptQueue.current];
        if (ids.length > 0) { emitReadReceipt(ids); readReceiptQueue.current.clear(); }
        window._readReceiptTimer = null;
      }, 1000);
    }
  }, [emitReadReceipt]);

  // Click suggestion chip to auto-fill and send
  const handleSuggestionClick = useCallback((question) => {
    setNewMessage(question);
    setIsAiTyping(true);
    // Use a small delay to let state update
    setTimeout(() => {
      if (isConnected && socket) {
        emitMessage(question, selectedSubject);
      }
    }, 100);
  }, [isConnected, socket, emitMessage, selectedSubject]);

  // Submit message
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isAiTyping) return;
    const userMsg = newMessage.trim();
    setNewMessage('');
    setUserIsTyping(false);
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId, text: userMsg, isUser: true,
      createdAt: new Date().toISOString(), readAt: new Date().toISOString()
    }]);
    setIsAiTyping(true);
    if (isConnected && socket) {
      emitMessage(userMsg, selectedSubject);
    } else {
      addToQueue({ text: userMsg, subject: selectedSubject, _id: tempId });
      setIsAiTyping(false);
      setIsOffline(true);
      try {
        const response = await axios.post(`${API_URL}/api/messages`,
          { text: userMsg, subject: selectedSubject, sessionId });
        setMessages(prev => {
          const filtered = prev.filter(msg => msg._id !== tempId);
          return [...filtered, response.data.userMessage, response.data.aiMessage];
        });
      } catch (err) {
        setMessages(prev => prev.map(msg =>
          msg._id === tempId ? { ...msg, _failed: true } : msg));
      } finally { setIsAiTyping(false); }
    }
  };

  // Typing indicator
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!userIsTyping && e.target.value.trim()) {
      setUserIsTyping(true);
      emitTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setUserIsTyping(false);
      emitTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e);
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Auth screen
  if (!authLoading && !isAuthenticated) {
    return showLogin ? (
      <LoginForm onLogin={login} onSwitch={() => setShowLogin(false)} />
    ) : (
      <RegisterForm onRegister={register} onSwitch={() => setShowLogin(true)} />
    );
  }

  if (authLoading) {
    return <div style={styles.loadingScreen}><div style={styles.loadingSpinner} /><p>Loading...</p></div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>BrainBytes AI Tutor</h1>
          <p style={styles.headerSubtitle}>
            {isConnected ? '🟢 Connected' : '🔴 Offline'} • {isAuthenticated ? user?.name : 'Guest'}
          </p>
        </div>
        <div style={styles.headerActions}>
          {selectedSubject && <span style={styles.subjectBadge}>{selectedSubject}</span>}
          <Link href="/dashboard"><button style={styles.navBtn}>📊 Dashboard</button></Link>
          <Link href="/profile"><button style={styles.navBtn}>👤 Profile</button></Link>
          <button onClick={logout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </div>

      {isOffline && (
        <div style={styles.offlineBanner}>⚠️ You're offline. Messages will be sent when reconnected.</div>
      )}

      <div className="chat-container" style={styles.chatContainer}>
        {loading ? (
          <div style={styles.loadingScreen}><p>Loading conversation history...</p></div>
        ) : messages.length === 0 ? (
          <div className="welcome-message" style={styles.welcomeMessage}>
            <h2>Welcome to BrainBytes AI Tutor! 🎉</h2>
            <p>I can help you with math, science, history, and more.</p>
            <p>Try asking me a question to get started!</p>
          </div>
        ) : (
          <div style={styles.messagesList}>
            {messages.map((message) => (
              <MessageBubble key={message._id} message={message}
                onVisible={!message.isUser ? handleMessageVisible : null}
                onSuggestionClick={handleSuggestionClick} />
            ))}
            {isAiTyping && (
              <div style={styles.typingIndicator}>
                <div style={styles.typingDot} />
                <div style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
                <div style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
                <span style={{ marginLeft: '8px', color: '#666', fontSize: '14px' }}>AI is thinking...</span>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      <div className="input-area" style={styles.inputArea}>
        <div style={styles.inputRow}>
          <select value={selectedSubject} className="subject-select"
            onChange={e => setSelectedSubject(e.target.value)} style={styles.subjectSelect}>
            <option value="">All Subjects</option>
            <option value="math">📐 Math</option>
            <option value="science">🔬 Science</option>
            <option value="history">📜 History</option>
            <option value="general">💡 General</option>
          </select>
          <div style={{ flex: 1, display: 'flex' }}>
            <input type="text" value={newMessage} onChange={handleInputChange}
              onKeyDown={handleKeyDown} className="message-input"
              placeholder="Ask a question... (Enter to send)"
              disabled={isAiTyping} style={styles.messageInput} />
            <button onClick={handleSubmit} className="send-button"
              disabled={isAiTyping || !newMessage.trim()}
              style={{ ...styles.sendButton, opacity: isAiTyping || !newMessage.trim() ? 0.6 : 1,
                cursor: isAiTyping || !newMessage.trim() ? 'not-allowed' : 'pointer' }}>
              {isAiTyping ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px', margin: '0 auto', padding: '0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Nunito, sans-serif',
    height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5'
  },
  authContainer: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', backgroundColor: '#f0f4ff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Nunito, sans-serif',
  },
  authCard: {
    backgroundColor: 'white', padding: '40px', borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', margin: '20px',
  },
  authTitle: { textAlign: 'center', color: '#1a237e', margin: '0 0 8px 0', fontSize: '28px' },
  authSubtitle: { textAlign: 'center', color: '#666', margin: '0 0 24px 0', fontSize: '16px' },
  authInput: {
    display: 'block', width: '100%', padding: '14px 16px', marginBottom: '14px',
    borderRadius: '10px', border: '2px solid #e0e0e0', fontSize: '16px',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  },
  authButton: {
    display: 'block', width: '100%', padding: '14px', backgroundColor: '#1a237e',
    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px',
    fontWeight: '600', cursor: 'pointer', marginTop: '8px',
  },
  switchText: { textAlign: 'center', color: '#666', marginTop: '20px', fontSize: '14px' },
  switchButton: {
    background: 'none', border: 'none', color: '#1a237e', fontWeight: '600',
    cursor: 'pointer', fontSize: '14px', textDecoration: 'underline',
  },
  errorBanner: {
    backgroundColor: '#ffebee', color: '#c62828', padding: '12px',
    borderRadius: '10px', marginBottom: '16px', fontSize: '14px', textAlign: 'center',
  },
  header: {
    backgroundColor: '#1a237e', color: 'white', padding: '16px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: '0 0 16px 16px',
  },
  headerTitle: { margin: 0, fontSize: '20px' },
  headerSubtitle: { margin: '4px 0 0 0', fontSize: '13px', opacity: 0.8 },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  subjectBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 12px',
    borderRadius: '12px', fontSize: '13px', textTransform: 'capitalize',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', color: 'white',
    border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
  },
  navBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', color: 'white',
    border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
    textDecoration: 'none',
  },
  offlineBanner: {
    backgroundColor: '#fff3e0', color: '#e65100', padding: '10px 24px',
    fontSize: '14px', textAlign: 'center', fontWeight: 500,
  },
  chatContainer: {
    flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f5f5f5',
  },
  messagesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  messageBubble: {
    padding: '12px 16px', borderRadius: '12px', maxWidth: '80%',
    wordBreak: 'break-word', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  messageMeta: {
    fontSize: '11px', color: '#888', marginTop: '6px',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  followUps: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px',
    borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '8px',
  },
  followUpChip: {
    backgroundColor: 'rgba(33,150,243,0.1)', color: '#1565c0',
    padding: '4px 10px', borderRadius: '12px', fontSize: '12px',
    cursor: 'pointer', border: '1px solid rgba(33,150,243,0.2)',
  },
  typingIndicator: {
    display: 'flex', alignItems: 'center', padding: '12px 16px',
    margin: '8px 0', backgroundColor: '#e8f5e9', borderRadius: '12px',
    maxWidth: '200px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  typingDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    backgroundColor: '#4caf50', margin: '0 2px',
    animation: 'bounce 1.4s infinite ease-in-out',
  },
  welcomeMessage: { textAlign: 'center', padding: '60px 20px', color: '#555' },
  inputArea: { backgroundColor: 'white', padding: '12px 16px', borderTop: '1px solid #e0e0e0' },
  inputRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  subjectSelect: {
    padding: '10px', borderRadius: '10px', border: '2px solid #e0e0e0',
    fontSize: '14px', backgroundColor: 'white', outline: 'none', minWidth: '120px',
  },
  messageInput: {
    flex: 1, padding: '12px 16px', borderRadius: '10px 0 0 10px',
    border: '2px solid #e0e0e0', borderRight: 'none', fontSize: '15px', outline: 'none',
  },
  sendButton: {
    padding: '12px 20px', backgroundColor: '#1a237e', color: 'white',
    border: 'none', borderRadius: '0 10px 10px 0', fontSize: '18px',
  },
  loadingScreen: {
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    alignItems: 'center', height: '100vh', gap: '16px', color: '#666',
  },
  loadingSpinner: {
    width: '40px', height: '40px',
    border: '4px solid #e0e0e0', borderTop: '4px solid #1a237e',
    borderRadius: '50%', animation: 'spin 1s linear infinite',
  },
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    input:focus, select:focus { border-color: #1a237e !important; outline: none; }
    button:hover { filter: brightness(1.1); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

    /* Responsive Design - Mobile */
    @media (max-width: 600px) {
      body { margin: 0; overflow: hidden; }
      .message-bubble { max-width: 90% !important; font-size: 15px; }
      .chat-container { height: calc(100vh - 140px) !important; padding: 10px !important; }
      .input-area { padding: 8px 10px !important; }
      .subject-select { min-width: 80px !important; font-size: 13px !important; padding: 8px !important; }
      .message-input { font-size: 15px !important; padding: 12px !important; }
      .send-button { padding: 12px 16px !important; }
      .auth-card { margin: 10px !important; padding: 24px !important; }
      .welcome-message h2 { font-size: 20px !important; }
    }

    /* Responsive Design - Tablet */
    @media (min-width: 601px) and (max-width: 900px) {
      .chat-container { height: 60vh !important; }
      .message-bubble { max-width: 85% !important; }
    }

    /* Responsive Design - Desktop */
    @media (min-width: 901px) {
      .chat-container { height: 65vh !important; }
    }

    /* Touch-friendly targets */
    @media (hover: none) and (pointer: coarse) {
      button, select, input { min-height: 48px; }
      .follow-up-chip { padding: 8px 14px !important; font-size: 14px !important; }
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body { background: #121212; }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  document.head.appendChild(style);
}
