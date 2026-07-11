import {
  assessContentSufficiency,
  determineExerciseCount,
  getLimitedContentMessage,
  countWords,
  parseGrammarResponse,
  buildGrammarPrompt,
  getGradeInstructions,
  handleGrammarGeneration,
  handleGrammarFeedback,
  parseFeedbackResponse,
  buildFeedbackPrompt,
  ContentSufficiency,
  GrammarDeps,
  GrammarGenerationRequest,
  GrammarFeedbackRequest,
  GrammarExerciseType,
} from './grammar';

describe('countWords', () => {
  it('counts words separated by spaces', () => {
    expect(countWords('hello world foo bar')).toBe(4);
  });

  it('handles multiple spaces and whitespace', () => {
    expect(countWords('  hello   world  ')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('handles newlines and tabs as separators', () => {
    expect(countWords('hello\nworld\tfoo')).toBe(3);
  });
});

describe('assessContentSufficiency', () => {
  it('returns "sufficient" for 200+ words', () => {
    const text = Array(200).fill('word').join(' ');
    expect(assessContentSufficiency(text)).toBe('sufficient');
  });

  it('returns "sufficient" for exactly 200 words', () => {
    const text = Array(200).fill('word').join(' ');
    expect(assessContentSufficiency(text)).toBe('sufficient');
  });

  it('returns "limited" for 50-199 words', () => {
    const text = Array(100).fill('word').join(' ');
    expect(assessContentSufficiency(text)).toBe('limited');
  });

  it('returns "limited" for exactly 50 words', () => {
    const text = Array(50).fill('word').join(' ');
    expect(assessContentSufficiency(text)).toBe('limited');
  });

  it('returns "minimal" for less than 50 words', () => {
    const text = Array(49).fill('word').join(' ');
    expect(assessContentSufficiency(text)).toBe('minimal');
  });

  it('returns "minimal" for very short content', () => {
    expect(assessContentSufficiency('hello world')).toBe('minimal');
  });

  it('returns "minimal" for empty content', () => {
    expect(assessContentSufficiency('')).toBe('minimal');
  });
});

describe('determineExerciseCount', () => {
  it('returns 5-10 for sufficient content', () => {
    const result = determineExerciseCount('sufficient');
    expect(result).toEqual({ min: 5, max: 10 });
  });

  it('returns 2-4 for limited content', () => {
    const result = determineExerciseCount('limited');
    expect(result).toEqual({ min: 2, max: 4 });
  });

  it('returns 1-1 for minimal content', () => {
    const result = determineExerciseCount('minimal');
    expect(result).toEqual({ min: 1, max: 1 });
  });
});

describe('getLimitedContentMessage', () => {
  it('returns limited=true with message for 2 exercises', () => {
    const result = getLimitedContentMessage(2);
    expect(result.limitedContent).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('limited');
  });

  it('returns limited=true with message for 3 exercises', () => {
    const result = getLimitedContentMessage(3);
    expect(result.limitedContent).toBe(true);
    expect(result.message).toBeDefined();
  });

  it('returns limited=true with message for 4 exercises', () => {
    const result = getLimitedContentMessage(4);
    expect(result.limitedContent).toBe(true);
    expect(result.message).toBeDefined();
  });

  it('returns limited=false with no message for 1 exercise', () => {
    const result = getLimitedContentMessage(1);
    expect(result.limitedContent).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('returns limited=false with no message for 5 exercises', () => {
    const result = getLimitedContentMessage(5);
    expect(result.limitedContent).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('returns limited=false with no message for 10 exercises', () => {
    const result = getLimitedContentMessage(10);
    expect(result.limitedContent).toBe(false);
    expect(result.message).toBeUndefined();
  });
});

describe('getGradeInstructions', () => {
  it('returns simple instructions for LKG', () => {
    const result = getGradeInstructions('LKG');
    expect(result).toContain('young learners');
  });

  it('returns simple instructions for 2nd grade', () => {
    const result = getGradeInstructions('2nd');
    expect(result).toContain('young learners');
  });

  it('returns moderate instructions for 3rd grade', () => {
    const result = getGradeInstructions('3rd');
    expect(result).toContain('primary school');
  });

  it('returns moderate instructions for 5th grade', () => {
    const result = getGradeInstructions('5th');
    expect(result).toContain('primary school');
  });

  it('returns advanced instructions for 6th grade', () => {
    const result = getGradeInstructions('6th');
    expect(result).toContain('secondary school');
  });

  it('returns advanced instructions for 12th grade', () => {
    const result = getGradeInstructions('12th');
    expect(result).toContain('secondary school');
  });
});

describe('buildGrammarPrompt', () => {
  it('includes language in the prompt', () => {
    const prompt = buildGrammarPrompt('Some text', 'Hindi', '5th', { min: 5, max: 10 });
    expect(prompt).toContain('Hindi');
  });

  it('includes exercise count bounds', () => {
    const prompt = buildGrammarPrompt('Some text', 'English', '3rd', { min: 2, max: 4 });
    expect(prompt).toContain('2');
    expect(prompt).toContain('4');
  });

  it('includes the transcript content', () => {
    const transcript = 'The quick brown fox jumps over the lazy dog';
    const prompt = buildGrammarPrompt(transcript, 'English', '5th', { min: 5, max: 10 });
    expect(prompt).toContain(transcript);
  });

  it('includes all four exercise types', () => {
    const prompt = buildGrammarPrompt('text', 'English', '5th', { min: 5, max: 10 });
    expect(prompt).toContain('sentence_building');
    expect(prompt).toContain('fill_in_blank');
    expect(prompt).toContain('word_reordering');
    expect(prompt).toContain('error_correction');
  });
});

describe('parseGrammarResponse', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      exercises: [
        {
          type: 'fill_in_blank',
          question: 'The cat ___ on the mat.',
          options: ['sit', 'sits', 'sat'],
          correctAnswer: 'sits',
          grammarRule: 'Subject-Verb Agreement',
        },
      ],
    });

    const result = parseGrammarResponse(response, 'English');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('fill_in_blank');
    expect(result[0].question).toBe('The cat ___ on the mat.');
    expect(result[0].correctAnswer).toBe('sits');
    expect(result[0].grammarRule).toBe('Subject-Verb Agreement');
    expect(result[0].language).toBe('English');
    expect(result[0].options).toEqual(['sit', 'sits', 'sat']);
  });

  it('parses response wrapped in markdown code fences', () => {
    const response = '```json\n{"exercises": [{"type": "word_reordering", "question": "dog the ran", "correctAnswer": "the dog ran", "grammarRule": "Word Order"}]}\n```';
    const result = parseGrammarResponse(response, 'English');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('word_reordering');
  });

  it('filters out invalid exercise types', () => {
    const response = JSON.stringify({
      exercises: [
        { type: 'fill_in_blank', question: 'q1', correctAnswer: 'a1', grammarRule: 'r1' },
        { type: 'invalid_type', question: 'q2', correctAnswer: 'a2', grammarRule: 'r2' },
        { type: 'sentence_building', question: 'q3', correctAnswer: 'a3', grammarRule: 'r3' },
      ],
    });

    const result = parseGrammarResponse(response, 'English');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('fill_in_blank');
    expect(result[1].type).toBe('sentence_building');
  });

  it('throws on missing exercises array', () => {
    expect(() => parseGrammarResponse('{"data": []}', 'English')).toThrow('Invalid grammar response');
  });

  it('assigns unique ids to exercises', () => {
    const response = JSON.stringify({
      exercises: [
        { type: 'fill_in_blank', question: 'q1', correctAnswer: 'a1', grammarRule: 'r1' },
        { type: 'fill_in_blank', question: 'q2', correctAnswer: 'a2', grammarRule: 'r2' },
      ],
    });

    const result = parseGrammarResponse(response, 'Hindi');
    expect(result[0].id).not.toBe(result[1].id);
  });

  it('sets language from parameter', () => {
    const response = JSON.stringify({
      exercises: [
        { type: 'error_correction', question: 'q', correctAnswer: 'a', grammarRule: 'r' },
      ],
    });

    const result = parseGrammarResponse(response, 'Kannada');
    expect(result[0].language).toBe('Kannada');
  });
});

describe('parseFeedbackResponse', () => {
  it('parses valid feedback response', () => {
    const response = JSON.stringify({
      correct: true,
      explanation: 'Good job!',
      grammarRule: 'Subject-Verb Agreement',
    });

    const result = parseFeedbackResponse(response);
    expect(result.correct).toBe(true);
    expect(result.explanation).toBe('Good job!');
    expect(result.grammarRule).toBe('Subject-Verb Agreement');
  });

  it('parses incorrect feedback', () => {
    const response = JSON.stringify({
      correct: false,
      explanation: 'The verb should agree with the singular subject.',
      grammarRule: 'Subject-Verb Agreement',
    });

    const result = parseFeedbackResponse(response);
    expect(result.correct).toBe(false);
  });

  it('handles markdown-wrapped response', () => {
    const response = '```json\n{"correct": false, "explanation": "Wrong tense.", "grammarRule": "Past Tense"}\n```';
    const result = parseFeedbackResponse(response);
    expect(result.correct).toBe(false);
    expect(result.grammarRule).toBe('Past Tense');
  });

  it('throws on invalid structure', () => {
    expect(() => parseFeedbackResponse('{"invalid": true}')).toThrow();
  });
});

describe('handleGrammarGeneration', () => {
  function createMockLLMClient(response: string): GrammarDeps {
    return {
      llmClient: {
        generate: jest.fn().mockResolvedValue(response),
      },
    };
  }

  const basePayload: GrammarGenerationRequest = {
    chapterId: 'chapter-1',
    learnerId: 'learner-1',
    gradeLevel: '5th',
    transcript: Array(200).fill('word').join(' '),
    language: 'English',
  };

  it('generates exercises for sufficient content (5-10)', async () => {
    const exercises = Array(7).fill(null).map((_, i) => ({
      type: 'fill_in_blank',
      question: `Question ${i + 1}`,
      correctAnswer: `Answer ${i + 1}`,
      grammarRule: `Rule ${i + 1}`,
    }));
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    const result = await handleGrammarGeneration(basePayload, deps);

    expect(result.exercises.length).toBeGreaterThanOrEqual(5);
    expect(result.exercises.length).toBeLessThanOrEqual(10);
    expect(result.limitedContent).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('generates exercises for limited content (2-4) with message', async () => {
    const exercises = Array(3).fill(null).map((_, i) => ({
      type: 'sentence_building',
      question: `Question ${i + 1}`,
      correctAnswer: `Answer ${i + 1}`,
      grammarRule: `Rule ${i + 1}`,
    }));
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    const payload = { ...basePayload, transcript: Array(100).fill('word').join(' ') };
    const result = await handleGrammarGeneration(payload, deps);

    expect(result.exercises.length).toBeGreaterThanOrEqual(2);
    expect(result.exercises.length).toBeLessThanOrEqual(4);
    expect(result.limitedContent).toBe(true);
    expect(result.message).toContain('limited');
  });

  it('generates 1 exercise for minimal content with no message', async () => {
    const exercises = [
      { type: 'fill_in_blank', question: 'Q1', correctAnswer: 'A1', grammarRule: 'R1' },
    ];
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    const payload = { ...basePayload, transcript: 'short text here' };
    const result = await handleGrammarGeneration(payload, deps);

    expect(result.exercises.length).toBe(1);
    expect(result.limitedContent).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('caps exercises at max bound', async () => {
    const exercises = Array(15).fill(null).map((_, i) => ({
      type: 'word_reordering',
      question: `Question ${i + 1}`,
      correctAnswer: `Answer ${i + 1}`,
      grammarRule: `Rule ${i + 1}`,
    }));
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    const result = await handleGrammarGeneration(basePayload, deps);

    expect(result.exercises.length).toBeLessThanOrEqual(10);
  });

  it('calls LLM with gpt-5-mini model', async () => {
    const exercises = [
      { type: 'fill_in_blank', question: 'Q', correctAnswer: 'A', grammarRule: 'R' },
    ];
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    await handleGrammarGeneration(basePayload, deps);

    expect(deps.llmClient.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'gpt-5-mini' })
    );
  });

  it('supports multiple languages', async () => {
    const exercises = Array(5).fill(null).map((_, i) => ({
      type: 'fill_in_blank',
      question: `प्रश्न ${i + 1}`,
      correctAnswer: `उत्तर ${i + 1}`,
      grammarRule: `नियम ${i + 1}`,
    }));
    const deps = createMockLLMClient(JSON.stringify({ exercises }));

    const payload = { ...basePayload, language: 'Hindi' };
    const result = await handleGrammarGeneration(payload, deps);

    expect(result.exercises[0].language).toBe('Hindi');
  });
});

describe('handleGrammarFeedback', () => {
  function createMockLLMClient(response: string): GrammarDeps {
    return {
      llmClient: {
        generate: jest.fn().mockResolvedValue(response),
      },
    };
  }

  const baseRequest: GrammarFeedbackRequest = {
    exerciseId: 'ex-1',
    exerciseType: 'fill_in_blank',
    question: 'The cat ___ on the mat.',
    correctAnswer: 'sits',
    learnerAnswer: 'sit',
    grammarRule: 'Subject-Verb Agreement',
    gradeLevel: '5th',
    language: 'English',
  };

  it('returns correct feedback for incorrect answer', async () => {
    const feedbackResponse = JSON.stringify({
      correct: false,
      explanation: 'The subject "cat" is singular, requiring "sits" not "sit".',
      grammarRule: 'Subject-Verb Agreement',
    });
    const deps = createMockLLMClient(feedbackResponse);

    const result = await handleGrammarFeedback(baseRequest, deps);

    expect(result.correct).toBe(false);
    expect(result.explanation).toContain('singular');
    expect(result.grammarRule).toBe('Subject-Verb Agreement');
    expect(result.correctAnswer).toBe('sits');
  });

  it('returns correct feedback for correct answer', async () => {
    const feedbackResponse = JSON.stringify({
      correct: true,
      explanation: 'Correct! "Sits" agrees with the singular subject "cat".',
      grammarRule: 'Subject-Verb Agreement',
    });
    const deps = createMockLLMClient(feedbackResponse);

    const request = { ...baseRequest, learnerAnswer: 'sits' };
    const result = await handleGrammarFeedback(request, deps);

    expect(result.correct).toBe(true);
    expect(result.explanation).toContain('Correct');
    expect(result.correctAnswer).toBe('sits');
  });

  it('includes grammar rule in response', async () => {
    const feedbackResponse = JSON.stringify({
      correct: false,
      explanation: 'Wrong tense used.',
      grammarRule: 'Present Tense',
    });
    const deps = createMockLLMClient(feedbackResponse);

    const result = await handleGrammarFeedback(baseRequest, deps);

    expect(result.grammarRule).toBe('Present Tense');
  });

  it('calls LLM with gpt-5-mini model', async () => {
    const feedbackResponse = JSON.stringify({
      correct: true,
      explanation: 'Good.',
      grammarRule: 'Rule',
    });
    const deps = createMockLLMClient(feedbackResponse);

    await handleGrammarFeedback(baseRequest, deps);

    expect(deps.llmClient.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: 'gpt-5-mini' })
    );
  });
});

describe('buildFeedbackPrompt', () => {
  it('includes exercise context in prompt', () => {
    const request: GrammarFeedbackRequest = {
      exerciseId: 'ex-1',
      exerciseType: 'fill_in_blank',
      question: 'The cat ___ sleeping.',
      correctAnswer: 'is',
      learnerAnswer: 'are',
      grammarRule: 'Subject-Verb Agreement',
      gradeLevel: '3rd',
      language: 'English',
    };

    const prompt = buildFeedbackPrompt(request);

    expect(prompt).toContain('fill_in_blank');
    expect(prompt).toContain('The cat ___ sleeping.');
    expect(prompt).toContain('is');
    expect(prompt).toContain('are');
    expect(prompt).toContain('3rd');
    expect(prompt).toContain('English');
  });
});
