const { buildConversationContext, buildPrompt } = require('../../utils/contextBuilder');

describe('buildConversationContext', () => {
  test('returns empty summary for null/undefined messages', () => {
    expect(buildConversationContext(null)).toEqual({
      summary: '',
      recentExchanges: [],
    });
    expect(buildConversationContext(undefined)).toEqual({
      summary: '',
      recentExchanges: [],
    });
  });

  test('returns empty summary for empty array', () => {
    expect(buildConversationContext([])).toEqual({
      summary: '',
      recentExchanges: [],
    });
  });

  test('builds exchanges for user and AI messages', () => {
    const messages = [
      { text: 'What is 2+2?', isUser: true },
      { text: '2+2 equals 4', isUser: false },
    ];

    const ctx = buildConversationContext(messages);
    expect(ctx.recentExchanges).toEqual([
      { role: 'user', text: 'What is 2+2?' },
      { role: 'assistant', text: '2+2 equals 4' },
    ]);
    expect(ctx.summary).toBe('Student: What is 2+2?\nTutor: 2+2 equals 4');
    expect(ctx.messageCount).toBe(2);
  });

  test('limits to maxHistory messages', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      text: `Message ${i + 1}`,
      isUser: i % 2 === 0,
    }));

    const ctx = buildConversationContext(messages, 5);
    expect(ctx.recentExchanges).toHaveLength(5);
    // Should take last 5
    expect(ctx.recentExchanges[0].text).toBe('Message 16');
    expect(ctx.recentExchanges[4].text).toBe('Message 20');
    expect(ctx.messageCount).toBe(20);
  });

  test('returns all messages when fewer than maxHistory', () => {
    const messages = [{ text: 'Hello', isUser: true }];

    const ctx = buildConversationContext(messages, 10);
    expect(ctx.recentExchanges).toHaveLength(1);
    expect(ctx.messageCount).toBe(1);
  });

  test('uses default maxHistory of 6', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      text: `Msg ${i}`,
      isUser: i % 2 === 0,
    }));

    const ctx = buildConversationContext(messages);
    expect(ctx.recentExchanges).toHaveLength(6);
    expect(ctx.messageCount).toBe(10);
  });

  test('summary joins exchanges with role labels', () => {
    const messages = [
      { text: 'Question 1', isUser: true },
      { text: 'Answer 1', isUser: false },
    ];

    const ctx = buildConversationContext(messages);
    expect(ctx.summary).toContain('Student: Question 1');
    expect(ctx.summary).toContain('Tutor: Answer 1');
  });
});

describe('buildPrompt', () => {
  test('builds math prompt with context', () => {
    const ctx = { summary: 'Student: 1+1\nTutor: 2' };
    const prompt = buildPrompt('What is 3+3?', 'math', ctx);

    expect(prompt).toContain('You are a patient math tutor');
    expect(prompt).toContain('Student: 1+1');
    expect(prompt).toContain("Student's math question: What is 3+3?");
    expect(prompt).toContain('step-by-step solutions');
  });

  test('builds math prompt without context', () => {
    const prompt = buildPrompt('Help with calculus', 'math', null);
    expect(prompt).toContain('New conversation.');
    expect(prompt).not.toContain('Student:');
  });

  test('builds science prompt', () => {
    const prompt = buildPrompt('What is evaporation?', 'science', null);
    expect(prompt).toContain('engaging science tutor');
    expect(prompt).toContain('real-world examples');
    expect(prompt).toContain("Student's science question: What is evaporation?");
  });

  test('builds history prompt with context', () => {
    const ctx = { summary: 'Student: Who is Rizal?\nTutor: National hero' };
    const prompt = buildPrompt('What did he write?', 'history', ctx);

    expect(prompt).toContain('knowledgeable history tutor');
    expect(prompt).toContain('Who is Rizal?');
    expect(prompt).toContain('accurate historical information');
    expect(prompt).toContain('causes and effects');
  });

  test('builds general prompt', () => {
    const prompt = buildPrompt('How are you?', 'general', null);
    expect(prompt).toContain('helpful AI tutor');
    expect(prompt).toContain('comprehensive answer');
    expect(prompt).toContain('encouraging and supportive');
    expect(prompt).toContain("Student's question: How are you?");
  });

  test('includes "New conversation." when context is null', () => {
    const prompts = [
      buildPrompt('q', 'math', null),
      buildPrompt('q', 'science', null),
      buildPrompt('q', 'history', null),
      buildPrompt('q', 'general', null),
    ];

    prompts.forEach((p) => {
      expect(p).toContain('New conversation.');
    });
  });

  test('includes context summary when present', () => {
    const ctx = { summary: 'Student: Hello\nTutor: Hi there' };
    const prompt = buildPrompt('q', 'math', ctx);
    expect(prompt).toContain('Student: Hello');
    expect(prompt).not.toContain('New conversation.');
  });

  test('all categories have required instruction structure', () => {
    const categories = ['math', 'science', 'history', 'general'];
    categories.forEach((cat) => {
      const prompt = buildPrompt('Test question', cat, null);
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });
  });
});
