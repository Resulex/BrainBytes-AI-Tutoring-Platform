const fetch = require('node-fetch');
const { aiRequestDuration, aiRequestErrors } = require('./metrics');

// Initialize our AI service
const initializeAI = () => {
  console.log('Hugging Face AI service initialized');

  // Check if the token is available
  if (!process.env.HUGGINGFACE_TOKEN) {
    console.warn('Warning: HUGGINGFACE_TOKEN environment variable not set. API calls may fail.');
  }
};

// Function to get response from Hugging Face API
async function generateResponse(question, preferredSubject = null, _context = null) {
  const questionType = detectQuestionType(question);
  // Define categories based on content
  const lowerQuestion = question.toLowerCase();

  const isMath =
    lowerQuestion.includes('calculate') ||
    lowerQuestion.includes('math') ||
    lowerQuestion.includes('1+1') ||
    /[+\-*/=]/.test(lowerQuestion) ||
    /\d+/.test(lowerQuestion);

  const isHistory =
    lowerQuestion.includes('history') ||
    lowerQuestion.includes('capital') ||
    lowerQuestion.includes('philippines') ||
    lowerQuestion.includes('president');

  const isScience =
    lowerQuestion.includes('science') ||
    lowerQuestion.includes('evaporation') ||
    lowerQuestion.includes('precipitation') ||
    lowerQuestion.includes('water') ||
    lowerQuestion.includes('chemical');

  // Basic sentiment analysis
  const frustrationKeywords = [
    'not working',
    'wrong',
    'bad',
    'stupid',
    'help',
    'confused',
    "don't understand",
  ];
  const isFrustrated = frustrationKeywords.some((k) => lowerQuestion.includes(k));

  // Determine the category based on keyword matching
  let category;
  if (preferredSubject && ['math', 'science', 'history', 'general'].includes(preferredSubject)) {
    category = preferredSubject;
  } else if (
    lowerQuestion.includes('math') ||
    lowerQuestion.includes('algebra') ||
    lowerQuestion.includes('calculus')
  ) {
    category = 'math';
  } else if (
    lowerQuestion.includes('science') ||
    lowerQuestion.includes('physics') ||
    lowerQuestion.includes('chemistry')
  ) {
    category = 'science';
  } else if (
    lowerQuestion.includes('history') ||
    lowerQuestion.includes('war') ||
    lowerQuestion.includes('century')
  ) {
    category = 'history';
  } else {
    category = 'general';
  }

  if (isFrustrated) {
    console.log('User may be frustrated. Providing empathetic response.');
    return {
      category,
      response: `I understand this might be confusing. Let me try to explain in a different way. ${getDetailedResponse(category, question, detectQuestionType(question))}`,
    };
  }

  // Check for direct matches to provide immediate responses without API call
  // This will bypass the API call for common questions we know will work
  if (lowerQuestion === 'what is 1+1' || lowerQuestion === '1+1') {
    return {
      category: 'math',
      response: 'The answer to 1+1 is 2.',
    };
  }

  if (lowerQuestion === 'what is evaporation') {
    return {
      category: 'science',
      response:
        "Evaporation is the process where liquid water changes into water vapor (gas). This happens when water molecules gain enough energy from heat to break free from the liquid's surface. Evaporation occurs at temperatures below water's boiling point and is a key part of the water cycle. It happens all around us - from wet clothes drying to puddles disappearing after rain.",
    };
  }

  if (lowerQuestion === 'what is science') {
    return {
      category: 'science',
      response:
        'Science is the systematic study of the natural world through observation, experimentation, and the formulation and testing of hypotheses. It aims to discover patterns and principles that help us understand how things work. The scientific method involves making observations, asking questions, forming hypotheses, conducting experiments, analyzing data, and drawing conclusions. Science encompasses many fields including physics, chemistry, biology, astronomy, geology, and more.',
    };
  }

  // For other questions, try the API with a strict timeout
  try {
    // ── Try local Ollama first (free, no API keys, always works) ──
    const ollamaResult = await tryOllama(question, preferredSubject, category);
    if (ollamaResult) return ollamaResult;

    // ── Try Gemini (generous free tier: 15 req/min) ──
    const geminiResult = await tryGemini(question, preferredSubject, category);
    if (geminiResult) return geminiResult;

    // ── Try Hugging Face as bonus (limited free credits) ──
    const hfResult = await tryHuggingFace(question, preferredSubject, category);
    if (hfResult) return hfResult;

    // ── All failed — use hardcoded fallback ──
    throw new Error('All AI providers unavailable');
  } catch (error) {
    console.error('All AI attempts failed:', error.message.split('\n')[0]);
    return {
      category,
      response: getDetailedResponse(category, question, questionType),
    };
  }
}

/**
 * Try local Ollama (100% free, runs locally, no API keys).
 * Uses OpenAI-compatible /v1/chat/completions endpoint.
 * Docker → host: host.docker.internal:11434
 */
async function tryOllama(question, preferredSubject, category) {
  const OLLAMA_URL = 'http://host.docker.internal:11434/v1/chat/completions';
  const MODEL = 'gemma2:2b';
  const TIMEOUT_MS = 30000;

  const systemPrompt = `You are BrainBytes, a friendly and encouraging AI tutor for students. You explain concepts clearly, use examples when helpful, and keep responses concise (under 150 words). Be supportive and patient.${preferredSubject ? ` The student prefers ${preferredSubject}.` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const aiStart = Date.now();

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 250,
        temperature: 0.7,
        stream: false,
      }),
    });

    console.log(`Ollama [${MODEL}] status: ${response.status}`);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      const dur = (Date.now() - aiStart) / 1000;
      aiRequestDuration.observe({ model: 'ollama-gemma2-2b', status: response.status }, dur);
      aiRequestErrors.inc({ model: 'ollama-gemma2-2b', error_type: `http_${response.status}` });
      console.log(`Ollama failed: ${response.status} - ${body.substring(0, 200)}`);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (content?.trim()) {
      const dur = (Date.now() - aiStart) / 1000;
      aiRequestDuration.observe({ model: 'ollama-gemma2-2b', status: 200 }, dur);
      return { category, response: content.trim() };
    }

    console.log('Ollama empty response');
    aiRequestErrors.inc({ model: 'ollama-gemma2-2b', error_type: 'empty_response' });
    return null;
  } catch (err) {
    console.log(`Ollama error (is Ollama running?): ${err.message.split('\n')[0]}`);
    aiRequestErrors.inc({ model: 'ollama-gemma2-2b', error_type: err.name === 'AbortError' ? 'timeout' : 'other' });
    return null;
  }
}

/**
 * Try Hugging Face Inference Providers (OpenAI-compatible router).
 * Returns { category, response } on success, null on failure.
 */
async function tryHuggingFace(question, preferredSubject, category) {
  const API_URL = 'https://router.huggingface.co/v1/chat/completions';
  const MODELS = ['Qwen/Qwen2.5-72B-Instruct'];
  const TIMEOUT_MS = 45000;

  const systemPrompt = `You are BrainBytes, a friendly and encouraging AI tutor for students. You explain concepts clearly, use examples when helpful, and keep responses concise (under 150 words). Be supportive and patient. ${preferredSubject ? `The student prefers ${preferredSubject}.` : ''}`;

  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) {
    console.warn('HUGGINGFACE_TOKEN not set — skipping HF');
    return null;
  }

  for (const model of MODELS) {
    let aiStart;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      aiStart = Date.now();

      const response = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          max_tokens: 250,
          temperature: 0.7,
        }),
      });

      console.log(`HF [${model}] status: ${response.status}`);
      clearTimeout(timeoutId);

      if (response.status === 402) {
        // Credits depleted — no point retrying HF
        const body = await response.text();
        console.log(`HF credits depleted: ${body.substring(0, 150)}`);
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        const body = await response.text();
        console.error(`HF auth failed: ${body}`);
        return null;
      }

      if (!response.ok) {
        const body = await response.text();
        const dur = (Date.now() - aiStart) / 1000;
        aiRequestDuration.observe({ model, status: response.status }, dur);
        aiRequestErrors.inc({ model, error_type: `http_${response.status}` });
        console.log(`HF [${model}] failed: ${response.status} - ${body.substring(0, 150)}`);
        continue;
      }

      const result = await response.json();
      if (result.error) {
        console.log(`HF [${model}] error: ${JSON.stringify(result.error).substring(0, 150)}`);
        continue;
      }

      const content = result.choices?.[0]?.message?.content;
      if (content?.trim()) {
        const dur = (Date.now() - aiStart) / 1000;
        aiRequestDuration.observe({ model, status: 200 }, dur);
        return { category, response: content.trim() };
      }

      console.log(`HF [${model}] empty response`);
      aiRequestErrors.inc({ model, error_type: 'empty_response' });
    } catch (err) {
      const dur = aiStart ? (Date.now() - aiStart) / 1000 : 0;
      if (err.name === 'AbortError') {
        console.log(`HF [${model}] timed out`);
        aiRequestDuration.observe({ model, status: 'timeout' }, dur);
        aiRequestErrors.inc({ model, error_type: 'timeout' });
      } else {
        console.log(`HF [${model}] error: ${err.message.split('\n')[0]}`);
        aiRequestDuration.observe({ model, status: 'error' }, dur);
        aiRequestErrors.inc({ model, error_type: 'other' });
      }
    }
  }

  return null;
}

/**
 * Try Google Gemini (generous free tier: 15 req/min, 1M tokens/day).
 * Falls back silently if GEMINI_API_KEY is not configured.
 */
async function tryGemini(question, preferredSubject, category) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set — skipping Gemini fallback');
    return null;
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const TIMEOUT_MS = 30000;

  const systemPrompt = `You are BrainBytes, a friendly and encouraging AI tutor for students. Explain concepts clearly, use examples when helpful, and keep responses concise (under 150 words). Be supportive and patient.${preferredSubject ? ` The student prefers ${preferredSubject}.` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const aiStart = Date.now();

    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 250, temperature: 0.7 },
      }),
    });

    console.log(`Gemini status: ${response.status}`);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text();
      const dur = (Date.now() - aiStart) / 1000;
      aiRequestDuration.observe({ model: 'gemini-2.0-flash', status: response.status }, dur);
      aiRequestErrors.inc({ model: 'gemini-2.0-flash', error_type: `http_${response.status}` });
      console.log(`Gemini failed: ${response.status} - ${body.substring(0, 200)}`);
      return null;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text?.trim()) {
      const dur = (Date.now() - aiStart) / 1000;
      aiRequestDuration.observe({ model: 'gemini-2.0-flash', status: 200 }, dur);
      return { category, response: text.trim() };
    }

    console.log('Gemini empty response');
    aiRequestErrors.inc({ model: 'gemini-2.0-flash', error_type: 'empty_response' });
    return null;
  } catch (err) {
    console.log(`Gemini error: ${err.message.split('\n')[0]}`);
    aiRequestErrors.inc({ model: 'gemini-2.0-flash', error_type: err.name === 'AbortError' ? 'timeout' : 'other' });
    return null;
  }
}

function detectQuestionType(question) {
  const lower = question.toLowerCase();
  const isDefinition = /^what (is|are|does)|define|meaning\b/.test(lower);
  const isExplanation = /explain|how (does|do|can)|why/.test(lower);
  const isExample = /example|give (me )?an example|show me/.test(lower);

  if (isDefinition) {
    return 'definition';
  }
  if (isExplanation) {
    return 'explanation';
  }
  if (isExample) {
    return 'example';
  }
  return 'general';
}

// More detailed fallback responses when the API call fails
function getDetailedResponse(category, question, questionType) {
  const lowerQuestion = question.toLowerCase();

  // Check for exact matches first
  if (lowerQuestion === 'what is 1+1' || lowerQuestion === '1+1') {
    return 'The answer to 1+1 is 2.';
  }

  if (lowerQuestion === 'what is evaporation') {
    return "Evaporation is the process where liquid water changes into water vapor (gas). This happens when water molecules gain enough energy from heat to break free from the liquid's surface. Evaporation occurs at temperatures below water's boiling point and is a key part of the water cycle. It happens all around us - from wet clothes drying to puddles disappearing after rain.";
  }

  if (lowerQuestion === 'what is science') {
    return 'Science is the systematic study of the natural world through observation, experimentation, and the formulation and testing of hypotheses. It aims to discover patterns and principles that help us understand how things work. The scientific method involves making observations, asking questions, forming hypotheses, conducting experiments, analyzing data, and drawing conclusions. Science encompasses many fields including physics, chemistry, biology, astronomy, geology, and more.';
  }

  // Handle science category
  if (category === 'science') {
    if (lowerQuestion.includes('precipitation')) {
      return "Precipitation is the release of water from the atmosphere to the earth's surface in the form of rain, snow, sleet, or hail. It's a key part of the water cycle where water vapor condenses in the atmosphere and becomes heavy enough to fall to the ground. Precipitation is essential for replenishing freshwater supplies and supporting plant and animal life.";
    }

    if (lowerQuestion.includes('evaporation')) {
      return "Evaporation is the process where liquid water changes into water vapor (gas). This happens when water molecules gain enough energy from heat to break free from the liquid's surface. Evaporation occurs at temperatures below water's boiling point and is a key part of the water cycle. It happens all around us - from wet clothes drying to puddles disappearing after rain.";
    }

    if (lowerQuestion.includes('science') || lowerQuestion.includes('scientific method')) {
      if (
        lowerQuestion.includes('branch') ||
        lowerQuestion.includes('field') ||
        lowerQuestion.includes('type')
      ) {
        return "Science has three main branches:\n\n🔬 **Physical Sciences** — Study of non-living systems\n• Physics (matter, energy, forces, motion)\n• Chemistry (elements, reactions, compounds)\n• Astronomy (stars, planets, universe)\n\n🧬 **Life Sciences (Biology)** — Study of living things\n• Botany (plants)\n• Zoology (animals)\n• Human Biology (body, health)\n• Ecology (ecosystems, environment)\n\n🌍 **Earth Sciences** — Study of the Earth\n• Geology (rocks, minerals, Earth's structure)\n• Meteorology (weather, climate)\n• Oceanography (oceans)\n\nThere are also applied sciences like medicine, engineering, and environmental science that combine multiple branches!";
      }
      return 'Science is the systematic study of the natural world through observation, experimentation, and the formulation and testing of hypotheses. It aims to discover patterns and principles that help us understand how things work. The scientific method involves making observations, asking questions, forming hypotheses, conducting experiments, analyzing data, and drawing conclusions. Science encompasses many fields including physics, chemistry, biology, astronomy, geology, and more.';
    }

    if (
      lowerQuestion.includes('gravity') ||
      lowerQuestion.includes('fall') ||
      lowerQuestion.includes('weight')
    ) {
      return "Gravity is the force that pulls objects toward each other. On Earth, it pulls everything toward the ground at an acceleration of 9.8 m/s². This is why apples fall from trees, why we stay on the ground, and why everything has weight. The greater an object's mass, the stronger its gravitational pull. Gravity is what keeps the Moon orbiting Earth and Earth orbiting the Sun!";
    }
    if (
      lowerQuestion.includes('photosynthesis') ||
      (lowerQuestion.includes('plant') && lowerQuestion.includes('food'))
    ) {
      return "Photosynthesis is how plants make their own food! They use sunlight energy, water (H₂O), and carbon dioxide (CO₂) to produce glucose (C₆H₁₂O₆) and oxygen (O₂). The chemical equation is: 6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂. This is why plants are called 'producers' in the food chain!";
    }
    if (lowerQuestion.includes('cell') || lowerQuestion.includes('organ')) {
      return 'Cells are the basic building blocks of all living things. The human body has about 37 trillion cells! There are many types: muscle cells help you move, nerve cells send electrical signals throughout your body, red blood cells carry oxygen, and white blood cells fight infections. Cells are like tiny factories that keep your body running.';
    }
    if (lowerQuestion.includes('energy')) {
      return 'Energy cannot be created or destroyed — it only changes form! This is the Law of Conservation of Energy. Common forms include: kinetic (motion energy), potential (stored energy), thermal (heat), chemical (stored in food/batteries), electrical, light, and sound energy. For example, a plant converts light energy from the sun into chemical energy through photosynthesis.';
    }
    if (
      lowerQuestion.includes('force') ||
      lowerQuestion.includes('motion') ||
      lowerQuestion.includes('newton')
    ) {
      return "Newton's Three Laws of Motion:\n1. An object at rest stays at rest, and an object in motion stays in motion unless acted on by an outside force (Law of Inertia).\n2. Force = mass x acceleration (F = ma). The harder you push, the more it accelerates!\n3. For every action, there is an equal and opposite reaction.";
    }
    if (
      lowerQuestion.includes('biology') ||
      lowerQuestion.includes('what is biology') ||
      lowerQuestion.includes('living')
    ) {
      return 'Biology is the scientific study of life and living organisms. It covers many exciting fields:\n\n🧬 **Cell Biology** — The basic unit of life, how cells work and divide\n🧪 **Genetics** — How traits are passed from parents to offspring (DNA)\n🌿 **Botany** — The study of plants\n🐾 **Zoology** — The study of animals\n🫀 **Human Biology** — How the human body works (heart, brain, lungs)\n🔬 **Microbiology** — The study of tiny organisms like bacteria and viruses\n🌍 **Ecology** — How living things interact with each other and their environment\n\nBiologists ask questions like: How do cells divide? How do genes work? How do ecosystems stay balanced?';
    }
    if (
      lowerQuestion.includes('atom') ||
      lowerQuestion.includes('molecule') ||
      lowerQuestion.includes('element')
    ) {
      return 'Atoms are the smallest units of matter. Each atom has a nucleus containing protons (positive charge) and neutrons (no charge), surrounded by electrons (negative charge) orbiting in shells. When atoms bond together, they form molecules. For example, H₂O (water) is 2 hydrogen atoms bonded to 1 oxygen atom. There are 118 known elements!';
    }
    if (
      lowerQuestion.includes('weather') ||
      lowerQuestion.includes('climate') ||
      lowerQuestion.includes('rain')
    ) {
      return 'Weather describes the day-to-day conditions in the atmosphere — temperature, rainfall, wind, humidity. Climate is the average weather over many years in a region. The water cycle drives our weather: evaporation (water turns to vapor) → condensation (clouds form) → precipitation (rain/snow falls) → collection (water gathers in rivers/oceans), then it starts all over again!';
    }
    if (
      lowerQuestion.includes('body') ||
      lowerQuestion.includes('human') ||
      lowerQuestion.includes('heart') ||
      lowerQuestion.includes('brain')
    ) {
      return "The human body is an amazing system! The heart pumps about 5 liters of blood through 100,000 km of blood vessels every minute. The brain has about 86 billion neurons (nerve cells) and controls everything. Your skeleton has 206 bones. The lungs breathe about 20,000 times a day. It's all working together to keep you alive and learning!";
    }
    if (lowerQuestion.includes('magnet') || lowerQuestion.includes('electricity')) {
      return "Electricity is the flow of electrons through a conductor. Magnets create magnetic fields that attract certain metals (like iron). Electricity and magnetism are actually two sides of the same force — electromagnetism! This is how electric motors, generators, and even your phone's wireless charging work.";
    }
    if (
      lowerQuestion.includes('ecosystem') ||
      lowerQuestion.includes('habitat') ||
      lowerQuestion.includes('environment')
    ) {
      return 'An ecosystem is a community of living things (plants, animals, microorganisms) interacting with their non-living environment (soil, water, air). Examples include forests, coral reefs, ponds, and grasslands. Every organism has a role — producers make food, consumers eat others, and decomposers break down dead matter to recycle nutrients.';
    }

    return formatScienceResponse(question);
  }

  // Handle math category
  if (category === 'math') {
    // Check for arithmetic expressions like "2+2", "10-3", "4*5", "20/4" etc.
    if (
      /^\d+\s*[+\-*/]\s*\d+/.test(lowerQuestion) ||
      /^what\s+(is|does)\s+\d+\s*[+\-*/]\s*\d+/.test(lowerQuestion)
    ) {
      try {
        // Try to evaluate simple arithmetic
        const sanitized = question.replace(/[^0-9+*\-.()%\s]/g, '');
        // Only evaluate if it's a simple expression (safe eval)
        if (/^[\d+*/.()%\s-]+$/.test(sanitized) && !sanitized.includes('**')) {
          // eslint-disable-next-line no-eval -- expression is sanitized to only allow digits and arithmetic operators
          const result = eval(sanitized);
          if (typeof result === 'number' && isFinite(result)) {
            return `The answer to ${question.trim()} is ${result}.`;
          }
        }
      } catch (e) {
        // If eval fails, fall through to keyword matching
      }
      // If eval didn't work, still give a useful response
      if (
        lowerQuestion.includes('+') ||
        lowerQuestion.includes('add') ||
        lowerQuestion.includes('sum') ||
        lowerQuestion.includes('plus')
      ) {
        return 'Addition means combining two or more numbers to find the total (sum). For example, 5 + 3 = 8. To add: line up numbers by place value, add from right to left, and carry when a column adds to 10 or more. What numbers would you like to add?';
      }
      if (
        lowerQuestion.includes('-') ||
        lowerQuestion.includes('subtract') ||
        lowerQuestion.includes('minus') ||
        lowerQuestion.includes('difference')
      ) {
        return 'Subtraction is taking one number away from another to find the difference. For example, 9 - 4 = 5. When subtracting, start with the larger number and take away the smaller one. Line up the numbers and subtract from right to left, borrowing when needed.';
      }
      if (
        lowerQuestion.includes('*') ||
        lowerQuestion.includes('×') ||
        lowerQuestion.includes('multiply') ||
        lowerQuestion.includes('times') ||
        lowerQuestion.includes('product')
      ) {
        return 'Multiplication is repeated addition! For example, 3 × 4 = 12 means 3+3+3+3 = 12. Key trick: any number × 10 just add a zero (5×10=50), any number × 5 is half of ×10 (5×6 = half of 60 = 30).';
      }
      if (
        lowerQuestion.includes('/') ||
        lowerQuestion.includes('÷') ||
        lowerQuestion.includes('divid') ||
        lowerQuestion.includes('quotient')
      ) {
        return 'Division is splitting a number into equal parts. For example, 12 ÷ 3 = 4 means splitting 12 into 3 equal groups of 4. Division is the opposite of multiplication. If you know 3×4=12, then 12÷3=4 and 12÷4=3.';
      }
    }
    if (lowerQuestion.includes('1+1')) {
      return 'The answer to 1+1 is 2.';
    }
    if (
      lowerQuestion.includes('add') ||
      lowerQuestion.includes('sum') ||
      lowerQuestion.includes('plus')
    ) {
      return 'Addition means combining two or more numbers to find the total (sum). For example, 5 + 3 = 8. Here are some tips:\n• Line up numbers by their place value\n• Add from right to left\n• Carry over when a column adds to 10 or more\n\nTry: 24 + 37 = ? (Start with 4+7=11, write 1 carry 1, then 2+3+1=6, answer is 61!)';
    }
    if (
      lowerQuestion.includes('subtract') ||
      lowerQuestion.includes('minus') ||
      lowerQuestion.includes('difference') ||
      lowerQuestion.includes('take away')
    ) {
      return 'Subtraction is taking one number away from another to find the difference. For example, 9 - 4 = 5. Key terms: the number you start with is the minuend, the number you subtract is the subtrahend, and the answer is the difference. When subtracting, start with the larger number and take away the smaller one.';
    }
    if (
      lowerQuestion.includes('multiply') ||
      lowerQuestion.includes('times') ||
      lowerQuestion.includes('product')
    ) {
      return 'Multiplication is repeated addition! For example, 3 × 4 = 12 means 3+3+3+3 = 12. Key terms: the numbers you multiply are factors, the answer is the product. A great trick: any number × 10 just add a zero (5×10=50), any number × 5 is half of ×10 (5×6 is half of 60 = 30).';
    }
    if (
      lowerQuestion.includes('divid') ||
      lowerQuestion.includes('quotient') ||
      lowerQuestion.includes('shared')
    ) {
      return 'Division is splitting a number into equal parts. For example, 12 ÷ 3 = 4 means splitting 12 into 3 equal groups of 4. Key terms: the dividend is the number being split, the divisor is how many groups, the quotient is the answer. Division and multiplication are opposite operations!';
    }
    if (
      lowerQuestion.includes('fraction') ||
      lowerQuestion.includes('numerator') ||
      lowerQuestion.includes('denominator')
    ) {
      return "A fraction represents a part of a whole! It has two parts:\n• Numerator (top) — how many parts you have\n• Denominator (bottom) — how many total equal parts\n\nFor example, ¾ means you have 3 out of 4 equal parts. If you eat 3 slices of a pizza cut into 8 slices, you've eaten ⅜ of the pizza!";
    }
    if (lowerQuestion.includes('decimal')) {
      return 'Decimals are another way to write fractions! The first digit after the decimal point is tenths (0.1 = 1/10), the second is hundredths (0.01 = 1/100), the third is thousandths (0.001 = 1/1000). To multiply by 10, move the decimal right one place (0.5 × 10 = 5). To divide by 10, move it left (0.5 ÷ 10 = 0.05).';
    }
    if (
      lowerQuestion.includes('percent') ||
      lowerQuestion.includes('%') ||
      lowerQuestion.includes('percentage')
    ) {
      return "Percent means 'out of 100' (from Latin 'per centum'). 50% = 50 out of 100 = half! Key conversions:\n• 50% = 0.5 = ½\n• 25% = 0.25 = ¼\n• 10% = 0.1 = 1/10\n• 100% = 1 = the whole thing\n\nTo find 10% of a number, divide by 10. To find 1%, divide by 100.";
    }
    if (
      lowerQuestion.includes('algebra') ||
      lowerQuestion.includes('equation') ||
      lowerQuestion.includes('solve for') ||
      lowerQuestion.includes('variable') ||
      lowerQuestion.includes('x +') ||
      lowerQuestion.includes('x =') ||
      lowerQuestion.includes('find x')
    ) {
      return 'Algebra uses letters (variables) to represent unknown numbers! The goal is to isolate the variable on one side of the equation. Example: x + 5 = 12 → subtract 5 from both sides → x = 7. Key rule: whatever you do to one side, do to the other! This keeps the equation balanced, just like a scale.';
    }
    if (
      lowerQuestion.includes('geometry') ||
      lowerQuestion.includes('area') ||
      lowerQuestion.includes('perimeter') ||
      lowerQuestion.includes('volume') ||
      lowerQuestion.includes('shape')
    ) {
      return 'Geometry is the study of shapes and their properties!\n• Area of a rectangle = length × width\n• Perimeter = distance around (add all sides)\n• Area of a triangle = ½ × base × height\n• Volume of a box = length × width × height\n• Circumference of a circle = 2πr\n• Area of a circle = πr²';
    }
    if (lowerQuestion.includes('word problem') || lowerQuestion.includes('story problem')) {
      return "Here's how to solve word problems:\n1️⃣ Read the problem carefully\n2️⃣ Identify what information you're given\n3️⃣ Determine what you need to find\n4️⃣ Choose the right operation (+, -, ×, ÷)\n5️⃣ Solve and check your answer\n\nWould you like to try a specific word problem together?";
    }
    if (
      lowerQuestion.includes('pythagorean') ||
      lowerQuestion.includes('right triangle') ||
      lowerQuestion.includes('hypotenuse')
    ) {
      return 'The Pythagorean Theorem says: a² + b² = c², where a and b are the legs of a right triangle and c is the hypotenuse (the longest side, opposite the right angle). If a right triangle has legs of 3 and 4, then: 3² + 4² = 9 + 16 = 25, so c = √25 = 5!';
    }

    return formatMathResponse(question);
  }

  // Handle history/geography category
  if (category === 'history') {
    if (lowerQuestion.includes('capital of the philippines')) {
      return "The capital of the Philippines is Manila. It's located on the island of Luzon and serves as the country's political, economic, and cultural center.";
    }
    if (lowerQuestion.includes('fish in filipino')) {
      return "The word for 'fish' in Filipino (Tagalog) is 'isda'.";
    }
    if (
      lowerQuestion.includes('president') ||
      lowerQuestion.includes('presidente') ||
      (lowerQuestion.includes('philippine') && lowerQuestion.includes('leader'))
    ) {
      return 'The Philippines has had 17 presidents since becoming a republic. Here are key ones:\n• Emilio Aguinaldo (1899-1901) — First president\n• Manuel L. Quezon (1935-1944) — First under the Commonwealth\n• Ferdinand Marcos (1965-1986) — Longest-serving\n• Corazon Aquino (1986-1992) — First female president\n• Rodrigo Duterte (2016-2022) — 16th president\n• Bongbong Marcos (2022-present) — 17th president';
    }
    if (lowerQuestion.includes('rizal') || lowerQuestion.includes('national hero')) {
      return "Dr. José Rizal (1861-1896) is the Philippines' national hero. He was a writer, doctor, and reformer who exposed Spanish colonial injustices through his novels 'Noli Me Tangere' (Touch Me Not) and 'El Filibusterismo' (The Reign of Greed). He was executed on December 30, 1896, which inspired the Philippine Revolution.";
    }
    if (
      lowerQuestion.includes('world war') ||
      lowerQuestion.includes('wwii') ||
      lowerQuestion.includes('ww2') ||
      (lowerQuestion.includes('japan') && lowerQuestion.includes('philippine'))
    ) {
      return 'World War II (1939-1945) deeply affected the Philippines. Japan occupied the country from 1942-1945. Key events:\n• Bataan Death March (1942) — Filipino and American POWs forced to march\n• Battle of Leyte Gulf (1944) — General MacArthur returned\n• Manila was the second most destroyed city after Warsaw\n• The Philippines gained independence on July 4, 1946';
    }
    if (lowerQuestion.includes('ancient') || lowerQuestion.includes('civilization')) {
      return 'Ancient civilizations shaped human history:\n• Mesopotamia (3500 BC) — First writing system (cuneiform)\n• Ancient Egypt (3100 BC) — Pyramids, hieroglyphics, pharaohs\n• Indus Valley (2600 BC) — Advanced city planning\n• Ancient China (2000 BC) — Great Wall, silk, paper\n• Ancient Greece (800 BC) — Democracy, philosophy, Olympics\n• Ancient Rome (753 BC) — Law, roads, concrete';
    }
    if (lowerQuestion.includes('revolution')) {
      return "Revolutions are major, rapid changes in society or government:\n• Philippine Revolution (1896-1898) — Filipinos fought Spanish rule, led by Bonifacio and Rizal's ideas\n• French Revolution (1789-1799) — Fought for 'Liberté, égalité, fraternité'\n• American Revolution (1775-1783) — 13 colonies gained independence from Britain\n• Industrial Revolution (1760-1840) — Machines changed how people worked and lived";
    }
    if (
      lowerQuestion.includes('spanish') ||
      lowerQuestion.includes('colon') ||
      lowerQuestion.includes('galleon')
    ) {
      return 'The Spanish colonized the Philippines for 333 years (1565-1898). Key facts:\n• Miguel López de Legazpi established the first settlement in Cebu\n• The Philippines was named after King Philip II of Spain\n• The Galleon Trade connected Manila and Acapulco for 250 years\n• Spanish introduced Christianity, which remains the dominant religion\n• José Rizal and other ilustrados pushed for reforms';
    }
    if (
      lowerQuestion.includes('independence') ||
      lowerQuestion.includes(' freedom') ||
      lowerQuestion.includes('liberation')
    ) {
      return 'The Philippines declared independence from Spain on June 12, 1898, in Kawit, Cavite. The Philippine flag was first unfurled, and the national anthem (Lupang Hinirang) was played. However, true independence came later — from the US on July 4, 1946. June 12 is celebrated as Independence Day.';
    }
    if (
      lowerQuestion.includes('hero') ||
      lowerQuestion.includes('andres') ||
      lowerQuestion.includes('bonifacio')
    ) {
      return "Andrés Bonifacio (1863-1897) is known as the 'Father of the Philippine Revolution.' He founded the Katipunan (KKK), a secret revolutionary society that fought for independence from Spain. His famous quote: 'Ang hindi magmahal sa sariling wika ay higit pa sa hayop at malansang isda' (He who does not love his own language is worse than animals and rotten fish).";
    }

    return formatHistoryResponse(question);
  }

  // Handle question type specific responses
  if (questionType === 'definition') {
    const definitions = {
      math: "In mathematics, this term refers to a specific concept used to describe relationships between numbers, shapes, or quantities. To give you a more precise definition, could you specify which math term you're asking about? Some common topics include fractions, algebra, geometry, and arithmetic.",
      science:
        "In science, this term describes a phenomenon, process, or concept in the natural world. Science is all about understanding how things work through observation and evidence. Could you tell me which specific scientific term you'd like defined?",
      history:
        'In history, this term refers to an event, period, or concept that helps us understand the past. History helps us learn from previous generations and understand how our present world came to be. Which historical term are you curious about?',
    };
    return (
      definitions[category] ||
      "That's a good term to learn about! To give you the best definition, could you provide a bit more context about what you're studying?"
    );
  }

  if (questionType === 'example') {
    const examples = {
      math: "Let me give you a math example! If you're working with fractions: 1/2 + 1/4 = 2/4 + 1/4 = 3/4. The key is finding a common denominator first. Would you like an example in a specific math topic like addition, multiplication, or algebra?",
      science:
        "Here's a science example: The water cycle works like this — the sun heats water in the ocean, it evaporates into water vapor, rises and forms clouds (condensation), then falls as rain (precipitation), and eventually flows back to the ocean. This cycle repeats endlessly!",
      history:
        "Here's a historical example: When studying cause and effect, consider how the assassination of Archduke Franz Ferdinand in 1914 triggered a chain of events that led to World War I. Single events can have enormous historical consequences!",
    };
    return (
      examples[category] ||
      "Great question! Here's an example: in everyday life, we use knowledge from all subjects without realizing it — counting money uses math, cooking involves science with chemical reactions, and understanding holidays connects us to history."
    );
  }

  // Default response for general questions
  return `That's a great question! Let me help you learn more.

${lowerQuestion.includes('?') ? 'I can provide information about various topics.' : 'What specific topic would you like to explore?'}

Subjects I can help with:
• 📐 **Math** — Arithmetic, algebra, geometry, fractions, percentages, word problems
• 🔬 **Science** — Biology (cells, body systems), chemistry (atoms, reactions), physics (forces, energy), earth science (weather, water cycle)
• 📜 **History** — Philippine history, world history, key figures, wars, revolutions, independence
• 💡 **General knowledge** — Definitions, examples, explanations, and any questions you have

Just ask me a question and I'll explain it step by step!`;
}

// Helper functions for context-aware fallback responses
function formatMathResponse(question) {
  const lower = question.toLowerCase();
  if (lower.includes('what')) {
    return "That's a good math concept to learn about! Mathematics uses precise rules and formulas. Could you tell me which specific math topic you're studying — arithmetic, algebra, geometry, or fractions? I can explain it step by step.";
  }
  if (lower.includes('how')) {
    return "Here's how to approach math problems: first, understand what the question is asking. Then identify the important numbers and what operation to use (add, subtract, multiply, or divide). Finally, solve step by step and check your answer. Would you like to practice with a specific type of problem?";
  }
  if (lower.includes('why')) {
    return "Math rules exist because they're based on logical patterns! For example, we borrow in subtraction because we can't take a larger digit from a smaller one. Understanding the 'why' makes math much easier to remember.";
  }
  return "That's an interesting math question! I can help with arithmetic (addition, subtraction, multiplication, division), fractions, decimals, percentages, algebra (solving for x), geometry (area, perimeter), and word problems. What specific topic are you working on?";
}

function formatScienceResponse(question) {
  const lower = question.toLowerCase();
  if (lower.includes('what')) {
    return 'Science helps explain the world around us! I can explain concepts in biology (living things), chemistry (matter and reactions), physics (energy and forces), and earth science (weather, water cycle, ecosystems). What topic interests you?';
  }
  if (lower.includes('how')) {
    return 'In science, understanding how things work involves looking at the process step by step. For example, how does a plant grow? It needs sunlight, water, and nutrients from soil — then through photosynthesis, it converts these into energy to grow. What process would you like me to explain?';
  }
  if (lower.includes('why')) {
    return "Why questions in science lead to fascinating discoveries! The reason things happen the way they do usually comes down to scientific laws and principles. Like why is the sky blue? It's because blue light scatters more in our atmosphere than other colors. What's your 'why' question?";
  }
  return 'Science covers so many amazing topics! 🔬 Biology (cells, body, plants, animals) • ⚗️ Chemistry (atoms, elements, reactions) • ⚡ Physics (forces, energy, motion) • 🌍 Earth Science (weather, climate, ecosystems). What would you like to explore?';
}

function formatHistoryResponse(question) {
  const lower = question.toLowerCase();
  if (lower.includes('who')) {
    return 'Many important figures have shaped history! From Philippine heroes like José Rizal and Andrés Bonifacio to world leaders, inventors, and thinkers. Which time period or person are you interested in?';
  }
  if (lower.includes('when')) {
    return 'Timing is key in history! Events are connected by cause and effect across different periods. The Philippines has a rich timeline from pre-colonial times, through 333 years of Spanish rule, American colonization, World War II, to independence and the present day. What period interests you?';
  }
  if (lower.includes('where')) {
    return 'Geography and history are closely connected! Different places developed unique cultures and histories based on their location, resources, and interactions with neighboring regions. Which place are you curious about?';
  }
  if (lower.includes('what')) {
    return 'History is full of interesting events and developments! The story of the Philippines includes ancient kingdoms, Spanish colonization, the Philippine Revolution, American rule, World War II, and the journey to becoming the vibrant nation it is today. What would you like to learn about?';
  }
  return 'History connects us to the past and helps us understand the present! I can tell you about Philippine history, world wars, ancient civilizations, revolutions, and important historical figures. What period or event interests you most?';
}

module.exports = {
  initializeAI,
  generateResponse,
  detectQuestionType,
};
