import { render, screen, fireEvent } from '@testing-library/react';
import Chat from '../../components/Chat';

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ messages: [] }),
  }),
);

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('Chat Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  // ── Rendering States ──

  test('renders chat interface with welcome message when no messages', () => {
    render(<Chat />);

    expect(screen.getByText(/BrainBytes AI Tutor/i)).toBeInTheDocument();
    expect(screen.getByText(/try asking me a question/i)).toBeInTheDocument();
  });

  test('renders input area with placeholder and send button', () => {
    render(<Chat />);

    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  test('renders messages when provided', () => {
    const messages = [
      { _id: '1', text: 'What is 1+1?', isUser: true },
      { _id: '2', text: 'The answer is 2.', isUser: false },
    ];

    render(<Chat messages={messages} />);

    expect(screen.getByTestId('messages-list')).toBeInTheDocument();
    expect(screen.getByText('What is 1+1?')).toBeInTheDocument();
    expect(screen.getByText('The answer is 2.')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<Chat isLoading={true} />);

    expect(screen.getByText(/loading conversation history/i)).toBeInTheDocument();
  });

  test('loading state hides chat container', () => {
    render(<Chat isLoading={true} />);

    expect(screen.queryByTestId('chat-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('welcome-message')).not.toBeInTheDocument();
  });

  test('shows typing indicator when AI is responding', () => {
    const messages = [{ _id: '1', text: 'Hello', isUser: true }];

    render(<Chat messages={messages} isAiTyping={true} />);

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/AI is thinking/i)).toBeInTheDocument();
  });

  test('does not show typing indicator when AI is not responding', () => {
    const messages = [{ _id: '1', text: 'Hello', isUser: true }];

    render(<Chat messages={messages} isAiTyping={false} />);

    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });

  test('shows offline banner when not connected', () => {
    render(<Chat isConnected={false} />);

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  test('does not show offline banner when connected', () => {
    render(<Chat isConnected={true} />);

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  test('renders empty welcome state when messages is empty array', () => {
    render(<Chat messages={[]} />);

    expect(screen.getByTestId('welcome-message')).toBeInTheDocument();
    expect(screen.queryByTestId('messages-list')).not.toBeInTheDocument();
  });

  test('transitions from welcome to messages view when messages provided', () => {
    const { rerender } = render(<Chat messages={[]} />);
    expect(screen.getByTestId('welcome-message')).toBeInTheDocument();

    rerender(<Chat messages={[{ _id: '1', text: 'Hi', isUser: true }]} />);
    expect(screen.queryByTestId('welcome-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('messages-list')).toBeInTheDocument();
  });

  // ── User Interactions ──

  test('send button is disabled when input is empty', () => {
    render(<Chat />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  test('send button becomes enabled when text is entered', () => {
    render(<Chat />);

    const input = screen.getByPlaceholderText(/type your question/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Hello' } });

    expect(sendButton).not.toBeDisabled();
  });

  test('send button is disabled while AI is typing', () => {
    render(<Chat isAiTyping={true} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'Hello' } });

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  test('input is disabled while AI is typing', () => {
    render(<Chat isAiTyping={true} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    expect(input).toBeDisabled();
  });

  test('input is enabled when AI is not typing', () => {
    render(<Chat isAiTyping={false} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    expect(input).not.toBeDisabled();
  });

  test('calls onSend when send button is clicked with text', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'What is 2+2?' } });

    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledWith('What is 2+2?');
  });

  test('clears input after successful send', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(input.value).toBe('');
  });

  test('does not call onSend when input is only whitespace', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: '   ' } });

    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    expect(handleSend).not.toHaveBeenCalled();
  });

  test('Enter key submits message', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(handleSend).toHaveBeenCalledWith('Hello');
  });

  test('Shift+Enter does not submit message', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(handleSend).not.toHaveBeenCalled();
  });

  test('Enter with empty input does not call onSend', () => {
    const handleSend = jest.fn();
    render(<Chat onSend={handleSend} />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(handleSend).not.toHaveBeenCalled();
  });

  test('typing in input updates its value', () => {
    render(<Chat />);

    const input = screen.getByPlaceholderText(/type your question/i);
    fireEvent.change(input, { target: { value: 'H' } });
    expect(input.value).toBe('H');

    fireEvent.change(input, { target: { value: 'Hello world' } });
    expect(input.value).toBe('Hello world');
  });

  // ── Subject Selector ──

  test('renders subject selector when onSubjectChange is provided', () => {
    const handleSubjectChange = jest.fn();

    render(<Chat onSubjectChange={handleSubjectChange} />);

    expect(screen.getByRole('combobox', { name: /select subject/i })).toBeInTheDocument();
    expect(screen.getByText('📐 Math')).toBeInTheDocument();
    expect(screen.getByText('🔬 Science')).toBeInTheDocument();
    expect(screen.getByText('📜 History')).toBeInTheDocument();
    expect(screen.getByText('💡 General')).toBeInTheDocument();
  });

  test('does not render subject selector when onSubjectChange is not provided', () => {
    render(<Chat />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  test('calls onSubjectChange when subject is selected', () => {
    const handleSubjectChange = jest.fn();
    render(<Chat onSubjectChange={handleSubjectChange} />);

    const select = screen.getByRole('combobox', { name: /select subject/i });
    fireEvent.change(select, { target: { value: 'science' } });

    expect(handleSubjectChange).toHaveBeenCalledWith('science');
  });

  test('reflects the current subject prop in select value', () => {
    render(<Chat subject="math" onSubjectChange={jest.fn()} />);

    const select = screen.getByRole('combobox', { name: /select subject/i });
    expect(select.value).toBe('math');
  });

  // ── Follow-up Suggestions ──

  test('renders follow-up suggestion buttons when present', () => {
    const messages = [
      {
        _id: '1',
        text: 'Here are some related topics.',
        isUser: false,
        followUps: ['What about fractions?', 'Explain decimals'],
      },
    ];

    render(<Chat messages={messages} />);

    expect(screen.getByText('What about fractions?')).toBeInTheDocument();
    expect(screen.getByText('Explain decimals')).toBeInTheDocument();
  });

  test('does not render follow-ups for user messages', () => {
    const messages = [
      {
        _id: '1',
        text: 'My question',
        isUser: true,
        followUps: ['Should not appear'],
      },
    ];

    render(<Chat messages={messages} />);

    expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
  });

  test('does not render follow-ups when absent', () => {
    const messages = [
      { _id: '1', text: 'Plain response', isUser: false, followUps: [] },
    ];

    render(<Chat messages={messages} />);

    expect(screen.queryByText('What about fractions?')).not.toBeInTheDocument();
    expect(screen.queryByText('Explain decimals')).not.toBeInTheDocument();
  });

  // ── Error / Edge States ──

  test('renders with no props (default values)', () => {
    render(<Chat />);

    expect(screen.getByTestId('welcome-message')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument();
  });

  test('renders many messages without performance issues', () => {
    const manyMessages = Array.from({ length: 50 }, (_, i) => ({
      _id: String(i),
      text: `Message ${i}`,
      isUser: i % 2 === 0,
    }));

    render(<Chat messages={manyMessages} />);

    expect(screen.getByText('Message 0')).toBeInTheDocument();
    expect(screen.getByText('Message 49')).toBeInTheDocument();
  });

  test('renders message with data-testid per message', () => {
    const messages = [
      { _id: 'abc123', text: 'Unique message', isUser: true },
    ];

    render(<Chat messages={messages} />);

    expect(screen.getByTestId('message-abc123')).toBeInTheDocument();
  });

  test('does not render online count or unrelated elements', () => {
    render(<Chat />);

    expect(screen.queryByText(/online/i)).not.toBeInTheDocument();
  });

  test('send button text is "Send"', () => {
    render(<Chat />);

    const button = screen.getByRole('button', { name: /send/i });
    expect(button).toHaveTextContent('Send');
  });
});
