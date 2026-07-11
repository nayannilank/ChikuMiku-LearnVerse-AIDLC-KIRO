/**
 * Grammar Exercise Generation Service.
 * Generates language-specific grammar exercises from chapter transcripts
 * using GPT-5 Mini, adapted to learner's grade level.
 *
 * Exercise types: sentence building, fill-in-the-blank, word reordering, error correction.
 *
 * Content sufficiency determines exercise count:
 * - ≥200 words → 5-10 exercises (sufficient)
 * - 50-199 words → 2-4 exercises (limited, shows message)
 * - <50 words → 1 exercise (minimal, no message)
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7
 */

import type { ILLMClient, LLMOptions } from './explanation';

/** Supported grammar exercise types. */
export type GrammarExerciseType =
  | 'sentence_building'
  | 'fill_in_blank'
  | 'word_reordering'
  | 'error_correction';

/** A single grammar exercise. */
export interface GrammarExercise {
  id: string;
  type: GrammarExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  grammarRule: string;
  language: string;
}

/** Result of grammar exercise generation. */
export interface GrammarGenerationResult {
  exercises: GrammarExercise[];
  limitedContent: boolean;
  message?: string;
}

/** Feedback for a submitted grammar exercise answer. */
export interface GrammarFeedback {
  correct: boolean;
  explanation: string;
  grammarRule: string;
  correctAnswer: string;
}

/** Content sufficiency classification. */
export type ContentSufficiency = 'sufficient' | 'limited' | 'minimal';

/** Dependencies for the grammar handler. */
export interface GrammarDeps {
  llmClient: ILLMClient;
}

/** Request payload for grammar exercise generation. */
export interface GrammarGenerationRequest {
  chapterId: string;
  learnerId: string;
  gradeLevel: string;
  transcript: string;
  language: string;
  subject?: string;
}

/** Request payload for grammar feedback. */
export interface GrammarFeedbackRequest {
  exerciseId: string;
  exerciseType: GrammarExerciseType;
  question: string;
  correctAnswer: string;
  learnerAnswer: string;
  grammarRule: string;
  gradeLevel: string;
  language: string;
}

/**
 * Counts words in a transcript string.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Assesses content sufficiency based on word count.
 * - sufficient: ≥200 words → 5-10 exercises
 * - limited: 50-199 words → 2-4 exercises
 * - minimal: <50 words → 1 exercise
 */
export function assessContentSufficiency(transcript: string): ContentSufficiency {
  const wordCount = countWords(transcript);

  if (wordCount >= 200) {
    return 'sufficient';
  }

  if (wordCount >= 50) {
    return 'limited';
  }

  return 'minimal';
}

/**
 * Determines exercise count range based on content sufficiency.
 */
export function determineExerciseCount(sufficiency: ContentSufficiency): { min: number; max: number } {
  switch (sufficiency) {
    case 'sufficient':
      return { min: 5, max: 10 };
    case 'limited':
      return { min: 2, max: 4 };
    case 'minimal':
      return { min: 1, max: 1 };
  }
}

/**
 * Determines the limited content message based on exercise count.
 * - 2-4 exercises: shows limited content message
 * - 1 exercise: no message
 * - 5+ exercises: no message (sufficient content)
 */
export function getLimitedContentMessage(exerciseCount: number): { limitedContent: boolean; message?: string } {
  if (exerciseCount >= 2 && exerciseCount <= 4) {
    return {
      limitedContent: true,
      message: 'Fewer exercises are available due to limited chapter content.',
    };
  }

  return { limitedContent: false };
}

/**
 * Builds the grammar generation prompt adapted to language and grade level.
 */
export function buildGrammarPrompt(
  transcript: string,
  language: string,
  gradeLevel: string,
  exerciseCount: { min: number; max: number }
): string {
  const gradeInstructions = getGradeInstructions(gradeLevel);

  return `You are a grammar exercise generator for ${language} language learners.
${gradeInstructions}

Generate between ${exerciseCount.min} and ${exerciseCount.max} grammar exercises based on the following chapter content.
Use language-specific grammar rules appropriate for ${language}.

Exercise types to include (mix of these types):
1. sentence_building - Give words/phrases that must be arranged into a correct sentence
2. fill_in_blank - Provide a sentence with a blank and the correct word to fill in
3. word_reordering - Give a jumbled sentence that must be reordered correctly
4. error_correction - Give a sentence with a grammatical error to identify and correct

For each exercise, provide:
- type: one of "sentence_building", "fill_in_blank", "word_reordering", "error_correction"
- question: the exercise prompt
- options: (optional) array of choices for fill_in_blank type
- correctAnswer: the correct response
- grammarRule: the grammar rule being tested (e.g., "Subject-Verb Agreement", "Tense Usage")

Respond in the following JSON format exactly:
{
  "exercises": [
    {
      "type": "fill_in_blank",
      "question": "The cat ___ on the mat.",
      "options": ["sit", "sits", "sat", "sitting"],
      "correctAnswer": "sits",
      "grammarRule": "Subject-Verb Agreement (Present Tense)"
    }
  ]
}

Chapter content:
${transcript}`;
}

/**
 * Returns grade-appropriate instructions for the prompt.
 */
export function getGradeInstructions(gradeLevel: string): string {
  const normalizedGrade = gradeLevel.toLowerCase().trim();

  const simpleGrades = ['lkg', 'ukg', '1st', '2nd', 'first', 'second'];
  const moderateGrades = ['3rd', '4th', '5th', 'third', 'fourth', 'fifth'];

  if (simpleGrades.some(g => normalizedGrade.includes(g))) {
    return 'Target very young learners (ages 4-7). Use extremely simple sentences, basic vocabulary, ' +
      'and fundamental grammar concepts like capitalization, punctuation, and simple present tense.';
  }

  if (moderateGrades.some(g => normalizedGrade.includes(g))) {
    return 'Target primary school learners (ages 8-10). Use clear sentences with moderate vocabulary, ' +
      'covering grammar concepts like tenses, articles, prepositions, and basic sentence structure.';
  }

  return 'Target secondary school learners (ages 11-17). Use complex sentences with advanced vocabulary, ' +
    'covering grammar concepts like passive voice, reported speech, conditionals, and complex clauses.';
}

/** Parsed exercise from LLM response. */
interface ParsedExerciseResponse {
  exercises: Array<{
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    grammarRule: string;
  }>;
}

/**
 * Parses the LLM response into structured grammar exercises.
 */
export function parseGrammarResponse(response: string, language: string): GrammarExercise[] {
  let jsonStr = response.trim();

  // Strip markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed: ParsedExerciseResponse = JSON.parse(jsonStr);

  if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
    throw new Error('Invalid grammar response structure: missing exercises array');
  }

  const validTypes: GrammarExerciseType[] = [
    'sentence_building',
    'fill_in_blank',
    'word_reordering',
    'error_correction',
  ];

  return parsed.exercises
    .filter(ex => validTypes.includes(ex.type as GrammarExerciseType))
    .map((ex, index) => ({
      id: `grammar-${Date.now()}-${index}`,
      type: ex.type as GrammarExerciseType,
      question: String(ex.question),
      options: ex.options ? ex.options.map(String) : undefined,
      correctAnswer: String(ex.correctAnswer),
      grammarRule: String(ex.grammarRule),
      language,
    }));
}

/**
 * Handles grammar exercise generation.
 * Assesses content sufficiency, generates exercises via GPT-5 Mini,
 * and applies limited content messaging rules.
 */
export async function handleGrammarGeneration(
  payload: GrammarGenerationRequest,
  deps: GrammarDeps
): Promise<GrammarGenerationResult> {
  const { transcript, language, gradeLevel } = payload;

  // Step 1: Assess content sufficiency
  const sufficiency = assessContentSufficiency(transcript);
  const exerciseCount = determineExerciseCount(sufficiency);

  // Step 2: Build prompt
  const prompt = buildGrammarPrompt(transcript, language, gradeLevel, exerciseCount);

  // Step 3: Call GPT-5 Mini
  const llmResponse = await deps.llmClient.generate(prompt, {
    temperature: 0.7,
    maxTokens: 2048,
    model: 'gpt-5-mini',
  });

  // Step 4: Parse exercises
  const exercises = parseGrammarResponse(llmResponse, language);

  // Step 5: Enforce exercise count bounds
  const boundedExercises = exercises.slice(0, exerciseCount.max);
  const finalExercises = boundedExercises.length < exerciseCount.min
    ? boundedExercises
    : boundedExercises;

  // Step 6: Determine limited content message
  const { limitedContent, message } = getLimitedContentMessage(finalExercises.length);

  return {
    exercises: finalExercises,
    limitedContent,
    message,
  };
}

/**
 * Builds the feedback prompt for evaluating a learner's answer.
 */
export function buildFeedbackPrompt(
  request: GrammarFeedbackRequest
): string {
  return `You are a grammar teacher evaluating a ${request.gradeLevel} student's answer in ${request.language}.

Exercise type: ${request.exerciseType}
Question: ${request.question}
Correct answer: ${request.correctAnswer}
Student's answer: ${request.learnerAnswer}
Grammar rule: ${request.grammarRule}

Evaluate whether the student's answer is correct. If incorrect, explain why and reference the grammar rule.
Keep the explanation appropriate for the student's grade level.

Respond in the following JSON format exactly:
{
  "correct": true/false,
  "explanation": "Brief explanation of why the answer is correct/incorrect",
  "grammarRule": "The grammar rule that applies"
}`;
}

/** Parsed feedback from LLM response. */
interface ParsedFeedbackResponse {
  correct: boolean;
  explanation: string;
  grammarRule: string;
}

/**
 * Parses the LLM feedback response.
 */
export function parseFeedbackResponse(response: string): ParsedFeedbackResponse {
  let jsonStr = response.trim();

  // Strip markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (typeof parsed.correct !== 'boolean' || !parsed.explanation || !parsed.grammarRule) {
    throw new Error('Invalid feedback response structure');
  }

  return {
    correct: parsed.correct,
    explanation: String(parsed.explanation),
    grammarRule: String(parsed.grammarRule),
  };
}

/**
 * Handles grammar feedback for a submitted exercise answer.
 * Evaluates correctness and returns explanation with grammar rule.
 */
export async function handleGrammarFeedback(
  payload: GrammarFeedbackRequest,
  deps: GrammarDeps
): Promise<GrammarFeedback> {
  // Step 1: Build feedback prompt
  const prompt = buildFeedbackPrompt(payload);

  // Step 2: Call GPT-5 Mini
  const llmResponse = await deps.llmClient.generate(prompt, {
    temperature: 0.3,
    maxTokens: 512,
    model: 'gpt-5-mini',
  });

  // Step 3: Parse feedback
  const parsed = parseFeedbackResponse(llmResponse);

  return {
    correct: parsed.correct,
    explanation: parsed.explanation,
    grammarRule: parsed.grammarRule,
    correctAnswer: payload.correctAnswer,
  };
}
