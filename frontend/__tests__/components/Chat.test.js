import { render, screen } from '@testing-library/react';
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

  test('renders chat interface with welcome message when no messages', () => {
    render(<Chat />);

    // Check for key text elements
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

  test('shows typing indicator when AI is responding', () => {
    const messages = [{ _id: '1', text: 'Hello', isUser: true }];

    render(<Chat messages={messages} isAiTyping={true} />);

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText(/AI is thinking/i)).toBeInTheDocument();
  });

  test('shows offline banner when not connected', () => {
    render(<Chat isConnected={false} />);

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  test('send button is disabled when input is empty', () => {
    render(<Chat />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  test('renders subject selector when onSubjectChange is provided', () => {
    const handleSubjectChange = jest.fn();

    render(<Chat onSubjectChange={handleSubjectChange} />);

    expect(screen.getByRole('combobox', { name: /select subject/i })).toBeInTheDocument();
    expect(screen.getByText('📐 Math')).toBeInTheDocument();
    expect(screen.getByText('🔬 Science')).toBeInTheDocument();
    expect(screen.getByText('📜 History')).toBeInTheDocument();
    expect(screen.getByText('💡 General')).toBeInTheDocument();
  });
});
