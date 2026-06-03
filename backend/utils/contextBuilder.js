/**
 * Build conversation context from message history for AI prompts.
 */

function buildConversationContext(messages, maxHistory = 6) {
  if (!messages || messages.length === 0) {
    return { summary: '', recentExchanges: [] };
  }

  // Take the most recent messages for context
  const recent = messages.slice(-maxHistory);

  const exchanges = recent.map((msg) => ({
    role: msg.isUser ? 'user' : 'assistant',
    text: msg.text,
  }));

  // Create a concise summary
  const summary = exchanges
    .map((e) => `${e.role === 'user' ? 'Student' : 'Tutor'}: ${e.text}`)
    .join('\n');

  return {
    summary,
    recentExchanges: exchanges,
    messageCount: messages.length,
  };
}

/**
 * Build a subject-specific prompt template.
 */
function buildPrompt(question, category, context = null) {
  const templates = {
    math: `You are a patient math tutor for Filipino students. Provide step-by-step explanations.

Context from previous conversation:
${context ? context.summary : 'New conversation.'}

Student's math question: ${question}

Please:
1. Show step-by-step solutions
2. Explain each step clearly
3. Use simple language suitable for students
4. If relevant, provide a real-world example
5. Ask if they want to practice similar problems`,

    science: `You are an engaging science tutor for Filipino students. Explain concepts with real-world examples.

Context from previous conversation:
${context ? context.summary : 'New conversation.'}

Student's science question: ${question}

Please:
1. Explain the concept in simple terms
2. Use relatable examples from daily life
3. Connect to the natural world around us
4. Suggest a simple experiment or observation they can try
5. Encourage curiosity by asking what else they wonder about`,

    history: `You are a knowledgeable history tutor for Filipino students. Make history engaging and relevant.

Context from previous conversation:
${context ? context.summary : 'New conversation.'}

Student's history question: ${question}

Please:
1. Provide accurate historical information
2. Explain causes and effects
3. Connect historical events to the present when possible
4. Include relevant dates and key figures
5. Make it engaging like a story`,

    general: `You are a helpful AI tutor for Filipino students. You cover math, science, history, and general knowledge.

Context from previous conversation:
${context ? context.summary : 'New conversation.'}

Student's question: ${question}

Please:
1. Give a clear, comprehensive answer
2. Use simple language
3. Provide examples where helpful
4. Break down complex topics
5. Be encouraging and supportive`,
  };

  return templates[category] || templates.general;
}

module.exports = { buildConversationContext, buildPrompt };
