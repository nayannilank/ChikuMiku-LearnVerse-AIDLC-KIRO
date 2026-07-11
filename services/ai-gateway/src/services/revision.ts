/**
 * Revision Quiz Generation Service.
 * Generates subject-specific revision questions from chapter transcripts
 * using GPT-5 Mini, adapted to learner's grade level and selected difficulty.
 *
 * Question types:
 * - Base: MCQ (4 options, 1 correct), Fill-in-blank, True/False, Short Answer (100 chars), Long Answer (1000 chars, scored 0-100)
 * - Language: Word Meaning, Sentence Forming
 * - Maths: Practical (arithmetic), Problem-based (multi-step word problems)
 * - Computers: Lab-style (write code, identify output, debug)
 * - Science/EVS: Diagram-based (label, identify, explain)
 *
 * Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 13.8
 */

import type { ILLMClient, LLMOptions } from './explanation';
import { getComplexityLevel } from './explanation';

/** Difficulty levels for revision quizzes. */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/** Supported question types including base and subject-specific formats. */
export type QuestionType =
  | 'mcq'
  | 'fill_in_blank'
  | 'true_false'
  | 'short_answer'
  | 'long_answer'
  | 'word_meaning'
  | 'sentence_forming'
  | 'practical'
  | 'problem_based'
  | 'lab_style'
  | 'diagram_based';

/** A single revision question. */
export interface RevisionQuestion {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  maxChars?: number;
}

/** Request payload for revision quiz generation. */
export interface RevisionGenerationRequest {
  chapterId: string;
  learnerId: string;
  gradeLevel: string;
  transcript: string;
  difficulty: DifficultyLevel;
  subject: string;
  questionCount?: number;
}

/** Result of revision quiz generation. */
export interface RevisionGenerationResult {
  questions: RevisionQuestion[];
  difficulty: DifficultyLevel;
  questionCount: number;
}

/** Dependencies for the revision handler. */
export interface RevisionDeps {
  llmClient: ILLMClient;
}

/** Base question types supported for all subjects. */
const BASE_QUESTION_TYPES: QuestionType[] = [
  'mcq',
  'fill_in_blank',
  'true_false',
  'short_answer',
  'long_answer',
];

/** Language subject identifiers (case-insensitive matching). */
const LANGUAGE_SUBJECTS = ['english', 'hindi', 'kannada'];

/**
 * Returns the list of question types applicable for a given subject.
 * Language subjects get word_meaning and sentence_forming.
 * Maths gets practical and problem_based.
 * Computers gets lab_style.
 * Science/EVS gets diagram_based.
 * All other subjects get only base types.
 */
export function getSubjectSpecificTypes(subject: string): QuestionType[] {
  const normalized = subject.toLowerCase().trim();

  if (LANGUAGE_SUBJECTS.includes(normalized) || normalized.includes('language')) {
    return [...BASE_QUESTION_TYPES, 'word_meaning', 'sentence_forming'];
  }

  if (normalized === 'maths' || normalized === 'math' || normalized === 'mathematics') {
    return [...BASE_QUESTION_TYPES, 'practical', 'problem_based'];
  }

  if (normalized === 'computers' || normalized === 'computer' || normalized === 'computer science') {
    return [...BASE_QUESTION_TYPES, 'lab_style'];
  }

  if (normalized === 'science' || normalized === 'evs' || normalized === 'environmental science') {
    return [...BASE_QUESTION_TYPES, 'diagram_based'];
  }

  return [...BASE_QUESTION_TYPES];
}

/**
 * Returns the default question count based on difficulty level.
 * Easy: 10, Medium: 15, Hard: 20
 */
export function getDefaultQuestionCount(difficulty: DifficultyLevel): number {
  switch (difficulty) {
    case 'easy':
      return 10;
    case 'medium':
      return 15;
    case 'hard':
      return 20;
  }
}

/**
 * Clamps a question count to the valid range [5, 20].
 */
export function clampQuestionCount(count: number): number {
  return Math.max(5, Math.min(20, count));
}

/**
 * Returns difficulty-specific instructions for the prompt.
 */
function getDifficultyInstructions(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'easy':
      return 'Generate easy questions that test basic recall and recognition. ' +
        'Use straightforward language and focus on direct facts from the content.';
    case 'medium':
      return 'Generate medium-difficulty questions that test understanding and application. ' +
        'Include questions that require connecting ideas and applying concepts.';
    case 'hard':
      return 'Generate hard questions that test analysis, evaluation, and synthesis. ' +
        'Include questions requiring critical thinking, multi-step reasoning, and deeper understanding.';
  }
}

/**
 * Returns subject-specific format instructions for the prompt.
 */
function getSubjectFormatInstructions(subject: string, types: QuestionType[]): string {
  const normalized = subject.toLowerCase().trim();

  if (types.includes('word_meaning')) {
    return `For this language subject (${subject}), also include:
- "word_meaning" questions: Provide a word and ask for its meaning/synonym/antonym
- "sentence_forming" questions: Provide words and ask to form a grammatically correct sentence`;
  }

  if (types.includes('practical')) {
    return `For this Maths subject, also include:
- "practical" questions: Arithmetic operations, calculations, and numerical problems
- "problem_based" questions: Multi-step word problems requiring mathematical reasoning`;
  }

  if (types.includes('lab_style')) {
    return `For this Computers subject, also include:
- "lab_style" questions: Write code snippets, identify program output, or debug code`;
  }

  if (types.includes('diagram_based')) {
    return `For this Science/EVS subject, also include:
- "diagram_based" questions: Label parts, identify structures, or explain processes (describe the diagram in text)`;
  }

  return '';
}

/**
 * Builds the revision quiz generation prompt adapted to subject, difficulty, and grade level.
 */
export function buildRevisionPrompt(
  transcript: string,
  difficulty: DifficultyLevel,
  subject: string,
  gradeLevel: string,
  count: number
): string {
  const complexity = getComplexityLevel(gradeLevel);
  const types = getSubjectSpecificTypes(subject);
  const difficultyInstructions = getDifficultyInstructions(difficulty);
  const subjectInstructions = getSubjectFormatInstructions(subject, types);

  const complexityInstructions: Record<string, string> = {
    simple: 'Use very simple language suitable for young children (ages 4-7). Keep questions short and clear.',
    moderate: 'Use clear language suitable for primary school students (ages 8-10). Questions can be moderately complex.',
    advanced: 'Use precise academic language suitable for secondary students (ages 11-17). Questions can be complex.',
  };

  const typeListStr = types.map(t => `"${t}"`).join(', ');

  return `You are a revision quiz generator for a ${gradeLevel} student studying ${subject}.
${complexityInstructions[complexity]}

${difficultyInstructions}

Generate exactly ${count} revision questions based on the following chapter content.
Use a mix of these question types: ${typeListStr}

Question format requirements:
- MCQ ("mcq"): Provide exactly 4 options with 1 correct answer
- Fill-in-the-blank ("fill_in_blank"): Provide a sentence with a blank and the correct word/phrase
- True/False ("true_false"): Provide a statement and whether it's "True" or "False"
- Short Answer ("short_answer"): Answer must be at most 100 characters. Set maxChars to 100.
- Long Answer ("long_answer"): Answer must be at most 1000 characters. Set maxChars to 1000.
${subjectInstructions}

For each question, provide:
- type: one of ${typeListStr}
- difficulty: "${difficulty}"
- question: the question text
- options: (required for "mcq" only) array of exactly 4 string choices
- correctAnswer: the correct response
- explanation: brief explanation of why this is the correct answer
- maxChars: (for "short_answer" set to 100, for "long_answer" set to 1000)

Respond in the following JSON format exactly:
{
  "questions": [
    {
      "type": "mcq",
      "difficulty": "${difficulty}",
      "question": "What is ...?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "explanation": "Because ..."
    }
  ]
}

Chapter content:
${transcript}`;
}

/** Parsed response structure from LLM. */
interface ParsedRevisionResponse {
  questions: Array<{
    type: string;
    difficulty?: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    maxChars?: number;
  }>;
}

/**
 * Parses the LLM response into structured revision questions.
 */
export function parseRevisionResponse(
  response: string,
  difficulty: DifficultyLevel
): RevisionQuestion[] {
  let jsonStr = response.trim();

  // Strip markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed: ParsedRevisionResponse = JSON.parse(jsonStr);

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('Invalid revision response structure: missing questions array');
  }

  const validTypes: QuestionType[] = [
    'mcq', 'fill_in_blank', 'true_false', 'short_answer', 'long_answer',
    'word_meaning', 'sentence_forming', 'practical', 'problem_based',
    'lab_style', 'diagram_based',
  ];

  return parsed.questions
    .filter(q => validTypes.includes(q.type as QuestionType))
    .map((q, index) => ({
      id: `revision-${Date.now()}-${index}`,
      type: q.type as QuestionType,
      difficulty,
      question: String(q.question),
      options: q.options ? q.options.map(String) : undefined,
      correctAnswer: String(q.correctAnswer),
      explanation: q.explanation ? String(q.explanation) : undefined,
      maxChars: q.maxChars ?? undefined,
    }));
}

/**
 * Handles revision quiz generation.
 * Builds a subject-specific prompt, calls GPT-5 Mini,
 * parses the response, and enforces question count bounds (5-20).
 */
export async function handleRevisionGeneration(
  payload: RevisionGenerationRequest,
  deps: RevisionDeps
): Promise<RevisionGenerationResult> {
  const { transcript, difficulty, subject, gradeLevel, questionCount } = payload;

  // Step 1: Determine target question count
  const targetCount = questionCount
    ? clampQuestionCount(questionCount)
    : getDefaultQuestionCount(difficulty);

  // Step 2: Build prompt
  const prompt = buildRevisionPrompt(transcript, difficulty, subject, gradeLevel, targetCount);

  // Step 3: Call GPT-5 Mini
  const llmResponse = await deps.llmClient.generate(prompt, {
    temperature: 0.7,
    maxTokens: 4096,
    model: 'gpt-5-mini',
  });

  // Step 4: Parse questions
  const questions = parseRevisionResponse(llmResponse, difficulty);

  // Step 5: Enforce question count bounds (5-20)
  const boundedQuestions = questions.slice(0, 20);
  const finalQuestions = boundedQuestions.length > 0 ? boundedQuestions : [];

  return {
    questions: finalQuestions,
    difficulty,
    questionCount: finalQuestions.length,
  };
}
