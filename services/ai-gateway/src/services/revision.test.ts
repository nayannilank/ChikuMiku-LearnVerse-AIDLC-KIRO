/**
 * Revision Quiz Generation Service Tests.
 * Verifies question count bounds, subject-specific types,
 * difficulty handling, MCQ validation, and response parsing.
 *
 * Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import {
  getSubjectSpecificTypes,
  getDefaultQuestionCount,
  clampQuestionCount,
  buildRevisionPrompt,
  parseRevisionResponse,
  handleRevisionGeneration,
} from './revision';
import type {
  DifficultyLevel,
  QuestionType,
  RevisionGenerationRequest,
  RevisionDeps,
} from './revision';

describe('Revision Quiz Generation Service', () => {
  describe('getSubjectSpecificTypes', () => {
    it('returns base types + word_meaning + sentence_forming for English', () => {
      const types = getSubjectSpecificTypes('English');
      expect(types).toContain('mcq');
      expect(types).toContain('fill_in_blank');
      expect(types).toContain('true_false');
      expect(types).toContain('short_answer');
      expect(types).toContain('long_answer');
      expect(types).toContain('word_meaning');
      expect(types).toContain('sentence_forming');
      expect(types).not.toContain('practical');
      expect(types).not.toContain('lab_style');
    });

    it('returns base types + word_meaning + sentence_forming for Hindi', () => {
      const types = getSubjectSpecificTypes('Hindi');
      expect(types).toContain('word_meaning');
      expect(types).toContain('sentence_forming');
    });

    it('returns base types + word_meaning + sentence_forming for Kannada', () => {
      const types = getSubjectSpecificTypes('Kannada');
      expect(types).toContain('word_meaning');
      expect(types).toContain('sentence_forming');
    });

    it('returns language types for custom language subjects', () => {
      const types = getSubjectSpecificTypes('French Language');
      expect(types).toContain('word_meaning');
      expect(types).toContain('sentence_forming');
    });

    it('returns base types + practical + problem_based for Maths', () => {
      const types = getSubjectSpecificTypes('Maths');
      expect(types).toContain('practical');
      expect(types).toContain('problem_based');
      expect(types).not.toContain('word_meaning');
      expect(types).not.toContain('lab_style');
    });

    it('returns base types + practical + problem_based for Mathematics', () => {
      const types = getSubjectSpecificTypes('Mathematics');
      expect(types).toContain('practical');
      expect(types).toContain('problem_based');
    });

    it('returns base types + lab_style for Computers', () => {
      const types = getSubjectSpecificTypes('Computers');
      expect(types).toContain('lab_style');
      expect(types).not.toContain('practical');
      expect(types).not.toContain('diagram_based');
    });

    it('returns base types + lab_style for Computer Science', () => {
      const types = getSubjectSpecificTypes('Computer Science');
      expect(types).toContain('lab_style');
    });

    it('returns base types + diagram_based for Science', () => {
      const types = getSubjectSpecificTypes('Science');
      expect(types).toContain('diagram_based');
      expect(types).not.toContain('lab_style');
      expect(types).not.toContain('practical');
    });

    it('returns base types + diagram_based for EVS', () => {
      const types = getSubjectSpecificTypes('EVS');
      expect(types).toContain('diagram_based');
    });

    it('returns only base types for unknown subjects', () => {
      const types = getSubjectSpecificTypes('Social Studies');
      expect(types).toEqual(['mcq', 'fill_in_blank', 'true_false', 'short_answer', 'long_answer']);
    });
  });

  describe('getDefaultQuestionCount', () => {
    it('returns 10 for easy difficulty', () => {
      expect(getDefaultQuestionCount('easy')).toBe(10);
    });

    it('returns 15 for medium difficulty', () => {
      expect(getDefaultQuestionCount('medium')).toBe(15);
    });

    it('returns 20 for hard difficulty', () => {
      expect(getDefaultQuestionCount('hard')).toBe(20);
    });
  });

  describe('clampQuestionCount', () => {
    it('clamps values below 5 to 5', () => {
      expect(clampQuestionCount(1)).toBe(5);
      expect(clampQuestionCount(0)).toBe(5);
      expect(clampQuestionCount(-10)).toBe(5);
    });

    it('clamps values above 20 to 20', () => {
      expect(clampQuestionCount(25)).toBe(20);
      expect(clampQuestionCount(100)).toBe(20);
    });

    it('keeps values within range unchanged', () => {
      expect(clampQuestionCount(5)).toBe(5);
      expect(clampQuestionCount(10)).toBe(10);
      expect(clampQuestionCount(15)).toBe(15);
      expect(clampQuestionCount(20)).toBe(20);
    });
  });

  describe('buildRevisionPrompt', () => {
    const transcript = 'The water cycle consists of evaporation, condensation, and precipitation.';

    it('includes difficulty level in the prompt', () => {
      const prompt = buildRevisionPrompt(transcript, 'hard', 'Science', '8th', 10);
      expect(prompt).toContain('hard');
      expect(prompt).toContain('analysis');
    });

    it('includes subject-specific types for language subjects', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'English', '5th', 10);
      expect(prompt).toContain('word_meaning');
      expect(prompt).toContain('sentence_forming');
    });

    it('includes subject-specific types for Maths', () => {
      const prompt = buildRevisionPrompt(transcript, 'medium', 'Maths', '6th', 10);
      expect(prompt).toContain('practical');
      expect(prompt).toContain('problem_based');
    });

    it('includes question count in the prompt', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'Science', '5th', 15);
      expect(prompt).toContain('15');
    });

    it('includes transcript content in the prompt', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'Science', '5th', 10);
      expect(prompt).toContain(transcript);
    });

    it('includes MCQ format instructions (4 options)', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'Science', '5th', 10);
      expect(prompt).toContain('exactly 4 options');
    });

    it('includes short answer maxChars instruction', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'Science', '5th', 10);
      expect(prompt).toContain('100 characters');
    });

    it('includes long answer maxChars instruction', () => {
      const prompt = buildRevisionPrompt(transcript, 'easy', 'Science', '5th', 10);
      expect(prompt).toContain('1000 characters');
    });
  });

  describe('parseRevisionResponse', () => {
    it('parses a valid JSON response with multiple question types', () => {
      const response = JSON.stringify({
        questions: [
          {
            type: 'mcq',
            question: 'What causes rain?',
            options: ['Evaporation', 'Condensation', 'Precipitation', 'All of these'],
            correctAnswer: 'All of these',
            explanation: 'Rain involves all three processes.',
          },
          {
            type: 'true_false',
            question: 'Water can exist in only two states.',
            correctAnswer: 'False',
            explanation: 'Water exists in three states: solid, liquid, gas.',
          },
          {
            type: 'short_answer',
            question: 'Name the process of water turning to gas.',
            correctAnswer: 'Evaporation',
            maxChars: 100,
          },
        ],
      });

      const questions = parseRevisionResponse(response, 'medium');
      expect(questions).toHaveLength(3);
      expect(questions[0].type).toBe('mcq');
      expect(questions[0].options).toHaveLength(4);
      expect(questions[0].difficulty).toBe('medium');
      expect(questions[1].type).toBe('true_false');
      expect(questions[2].type).toBe('short_answer');
      expect(questions[2].maxChars).toBe(100);
    });

    it('parses response wrapped in markdown code fences', () => {
      const response = '```json\n{"questions": [{"type": "mcq", "question": "Q?", "options": ["A","B","C","D"], "correctAnswer": "A"}]}\n```';
      const questions = parseRevisionResponse(response, 'easy');
      expect(questions).toHaveLength(1);
      expect(questions[0].type).toBe('mcq');
    });

    it('filters out invalid question types', () => {
      const response = JSON.stringify({
        questions: [
          { type: 'mcq', question: 'Q?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
          { type: 'invalid_type', question: 'Q?', correctAnswer: 'X' },
        ],
      });

      const questions = parseRevisionResponse(response, 'easy');
      expect(questions).toHaveLength(1);
    });

    it('throws on invalid response structure', () => {
      expect(() => parseRevisionResponse('{"data": []}', 'easy')).toThrow(
        'Invalid revision response structure'
      );
    });

    it('throws on non-JSON response', () => {
      expect(() => parseRevisionResponse('not json at all', 'easy')).toThrow();
    });

    it('assigns unique IDs to each question', () => {
      const response = JSON.stringify({
        questions: [
          { type: 'true_false', question: 'Q1', correctAnswer: 'True' },
          { type: 'true_false', question: 'Q2', correctAnswer: 'False' },
        ],
      });

      const questions = parseRevisionResponse(response, 'hard');
      expect(questions[0].id).not.toBe(questions[1].id);
    });

    it('correctly parses subject-specific types', () => {
      const response = JSON.stringify({
        questions: [
          { type: 'word_meaning', question: 'Define "photosynthesis"', correctAnswer: 'The process...' },
          { type: 'diagram_based', question: 'Label the parts', correctAnswer: 'A: root, B: stem' },
          { type: 'lab_style', question: 'What is the output?', correctAnswer: 'Hello World' },
          { type: 'practical', question: 'Calculate 25 + 37', correctAnswer: '62' },
          { type: 'problem_based', question: 'A train...', correctAnswer: '120 km' },
        ],
      });

      const questions = parseRevisionResponse(response, 'medium');
      expect(questions).toHaveLength(5);
      expect(questions.map(q => q.type)).toEqual([
        'word_meaning', 'diagram_based', 'lab_style', 'practical', 'problem_based',
      ]);
    });
  });

  describe('handleRevisionGeneration', () => {
    const mockLLMClient = {
      generate: jest.fn(),
    };

    const deps: RevisionDeps = {
      llmClient: mockLLMClient,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    const basePayload: RevisionGenerationRequest = {
      chapterId: 'chapter-1',
      learnerId: 'learner-1',
      gradeLevel: '5th',
      transcript: 'The water cycle includes evaporation, condensation, and precipitation. '
        + 'Water evaporates from surfaces, forms clouds, and falls as rain.',
      difficulty: 'medium',
      subject: 'Science',
    };

    it('calls GPT-5 Mini with correct options', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: [
          { type: 'mcq', question: 'Q?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
        ],
      }));

      await handleRevisionGeneration(basePayload, deps);

      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 4096,
          model: 'gpt-5-mini',
        })
      );
    });

    it('uses default question count based on difficulty when not specified', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: Array.from({ length: 15 }, (_, i) => ({
          type: 'true_false',
          question: `Q${i}?`,
          correctAnswer: 'True',
        })),
      }));

      const result = await handleRevisionGeneration(basePayload, deps);
      // medium difficulty defaults to 15
      const prompt = mockLLMClient.generate.mock.calls[0][0];
      expect(prompt).toContain('15');
    });

    it('clamps question count to valid range', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: [
          { type: 'true_false', question: 'Q?', correctAnswer: 'True' },
        ],
      }));

      await handleRevisionGeneration({ ...basePayload, questionCount: 50 }, deps);
      const prompt = mockLLMClient.generate.mock.calls[0][0];
      expect(prompt).toContain('20'); // clamped from 50 to 20
    });

    it('returns questions with difficulty and questionCount', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: [
          { type: 'mcq', question: 'Q?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
          { type: 'fill_in_blank', question: 'Water ___ from surfaces.', correctAnswer: 'evaporates' },
        ],
      }));

      const result = await handleRevisionGeneration(basePayload, deps);

      expect(result.difficulty).toBe('medium');
      expect(result.questionCount).toBe(2);
      expect(result.questions).toHaveLength(2);
    });

    it('enforces max 20 questions in output', async () => {
      const manyQuestions = Array.from({ length: 25 }, (_, i) => ({
        type: 'true_false',
        question: `Statement ${i}`,
        correctAnswer: 'True',
      }));

      mockLLMClient.generate.mockResolvedValue(JSON.stringify({ questions: manyQuestions }));

      const result = await handleRevisionGeneration(basePayload, deps);
      expect(result.questions.length).toBeLessThanOrEqual(20);
      expect(result.questionCount).toBeLessThanOrEqual(20);
    });

    it('handles empty questions array gracefully', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({ questions: [] }));

      const result = await handleRevisionGeneration(basePayload, deps);
      expect(result.questions).toEqual([]);
      expect(result.questionCount).toBe(0);
    });

    it('includes subject-specific types in prompt for Maths', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: [
          { type: 'practical', question: 'Calculate 5 x 7', correctAnswer: '35' },
        ],
      }));

      await handleRevisionGeneration({ ...basePayload, subject: 'Maths' }, deps);
      const prompt = mockLLMClient.generate.mock.calls[0][0];
      expect(prompt).toContain('practical');
      expect(prompt).toContain('problem_based');
    });

    it('handles MCQ questions with exactly 4 options', async () => {
      mockLLMClient.generate.mockResolvedValue(JSON.stringify({
        questions: [
          {
            type: 'mcq',
            question: 'What is H2O?',
            options: ['Water', 'Oxygen', 'Hydrogen', 'Carbon'],
            correctAnswer: 'Water',
            explanation: 'H2O is the chemical formula for water.',
          },
        ],
      }));

      const result = await handleRevisionGeneration(basePayload, deps);
      const mcq = result.questions[0];
      expect(mcq.type).toBe('mcq');
      expect(mcq.options).toHaveLength(4);
      expect(mcq.options).toContain(mcq.correctAnswer);
    });
  });
});
