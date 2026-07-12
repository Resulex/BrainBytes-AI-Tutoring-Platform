/**
 * Generate follow-up question suggestions based on category and response content.
 */

function suggestFollowUps(category, question, response) {
  const lowerQuestion = question.toLowerCase();
  const lowerResponse = (response || '').toLowerCase();

  const suggestions = {
    math: [
      'Can you give me another example problem to solve?',
      'What are some real-world applications of this?',
      'Can you explain this concept with a different approach?',
    ],
    science: [
      'Can you tell me more about how this works?',
      'What is a simple experiment I can try at home?',
      'How does this connect to other scientific concepts?',
    ],
    history: [
      'What led up to this event?',
      'How did this affect people at the time?',
      'Are there other similar events in history?',
    ],
    general: [
      'Can you tell me more about this topic?',
      'What are some key points I should remember?',
      'Where can I learn more about this?',
    ],
  };

  const defaults = suggestions[category] || suggestions.general;

  // Try to find more specific suggestions based on response content
  const specificFollowUps = [];

  if (lowerResponse.includes('example') || lowerResponse.includes('for instance')) {
    specificFollowUps.push('Can you give me another example?');
  }
  if (
    lowerResponse.includes('step') ||
    lowerResponse.includes('first') ||
    lowerResponse.includes('next')
  ) {
    specificFollowUps.push('Can you walk me through that again more slowly?');
  }
  if (
    category === 'math' &&
    (lowerQuestion.includes('solve') || lowerQuestion.includes('calculate'))
  ) {
    specificFollowUps[0] = 'Can you create a similar problem for me to practice?';
  }

  // Merge specific with defaults, avoid duplicates
  const allSuggestions = [...specificFollowUps, ...defaults];
  const unique = [...new Set(allSuggestions)];

  return unique.slice(0, 3);
}

module.exports = { suggestFollowUps };
