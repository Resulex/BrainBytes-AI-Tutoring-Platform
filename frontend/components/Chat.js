import { useState, useRef, useEffect } from 'react';

/**
 * Chat component - displays messages and provides an input area.
 * Designed to be testable standalone, or embedded in pages/index.js.
 */
export default function Chat({
  messages = [],
  onSend,
  isAiTyping = false,
  isConnected = true,
  isLoading = false,
  subject = '',
  onSubjectChange,
}) {
  const [newMessage, setNewMessage] = useState('');
  const messageEndRef = useRef(null);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    onSend?.(newMessage);
    setNewMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  if (isLoading) {
    return (
      <div className="chat-loading">
        <p>Loading conversation history...</p>
      </div>
    );
  }

  return (
    <div className="chat-container" data-testid="chat-container">
      {messages.length === 0 ? (
        <div className="welcome-message" data-testid="welcome-message">
          <h2>Welcome to BrainBytes AI Tutor! 🎉</h2>
          <p>I can help you with math, science, history, and more.</p>
          <p>Try asking me a question to get started!</p>
        </div>
      ) : (
        <div className="messages-list" data-testid="messages-list">
          {messages.map((message) => (
            <div
              key={message._id}
              className={`message ${message.isUser ? 'message-user' : 'message-ai'}`}
              data-testid={`message-${message._id}`}
            >
              <p>{message.text}</p>
              {!message.isUser && message.followUps?.length > 0 && (
                <div className="followups">
                  {message.followUps.map((suggestion, idx) => (
                    <button key={idx} className="suggestion-btn">
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isAiTyping && (
            <div className="typing-indicator" data-testid="typing-indicator">
              <span>AI is thinking...</span>
            </div>
          )}
          <div ref={messageEndRef} />
        </div>
      )}

      <div className="input-area" data-testid="input-area">
        <div className="input-row">
          {onSubjectChange && (
            <select
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              aria-label="Select subject"
            >
              <option value="">All Subjects</option>
              <option value="math">📐 Math</option>
              <option value="science">🔬 Science</option>
              <option value="history">📜 History</option>
              <option value="general">💡 General</option>
            </select>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            disabled={isAiTyping}
            aria-label="Type your question"
          />
          <button
            onClick={handleSubmit}
            disabled={!newMessage.trim() || isAiTyping}
            role="button"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
        {!isConnected && (
          <div className="offline-banner" data-testid="offline-banner">
            ⚠️ You are offline
          </div>
        )}
      </div>
    </div>
  );
}
