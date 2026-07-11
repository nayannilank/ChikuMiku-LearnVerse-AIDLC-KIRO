/**
 * Explanation Generation Service.
 * Generates page-by-page explanations using GPT-5 Mini,
 * synthesizes TTS audio via Google TTS, and stores in S3.
 *
 * Each explanation includes:
 * - Summary (max 200 words)
 * - Keywords (3-10 items)
 * - Concepts (1-5 items)
 * - Audio URL (optional, from TTS + S3)
 *
 * Complexity is adapted to the learner's grade level.
 *
 * Requirements: 9.1, 9.2, 9.6, 9.7
 */

import type { ExplanationResult } from '@chikumiku/types';

/** Interface for LLM (GPT-5 Mini) calls. */
export interface ILLMClient {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
}

/** Options for LLM generation. */
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/** Interface for Google TTS synthesis. */
export interface ITTSClient {
  synthesize(text: string, language: string): Promise<Buffer>;
}

/** Interface for S3 storage operations. */
export interface IS3Client {
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
}

/** Dependencies for the explanation handler. */
export interface ExplanationDeps {
  llmClient: ILLMClient;
  ttsClient: ITTSClient;
  s3Client: IS3Client;
}

/** Request payload for explanation generation. */
export interface ExplanationRequest {
  chapterId: string;
  learnerId: string;
  gradeLevel: string;
  pages: TranscriptPageInput[];
  subject?: string;
  language?: string;
}

/** Input page from the transcript. */
export interface TranscriptPageInput {
  pageNumber: number;
  text: string;
  language?: string;
}

/** Parsed LLM response structure. */
export interface ParsedExplanation {
  summary: string;
  keywords: string[];
  concepts: string[];
}

/** Complexity levels for grade-based adaptation. */
export type ComplexityLevel = 'simple' | 'moderate' | 'advanced';

/**
 * Determines the complexity level based on the learner's grade.
 * - LKG, UKG, 1st, 2nd → simple
 * - 3rd, 4th, 5th → moderate
 * - 6th through 12th → advanced
 */
export function getComplexityLevel(gradeLevel: string): ComplexityLevel {
  const normalizedGrade = gradeLevel.toLowerCase().trim();

  const simpleGrades = ['lkg', 'ukg', '1st', '2nd', 'first', 'second'];
  const moderateGrades = ['3rd', '4th', '5th', 'third', 'fourth', 'fifth'];

  if (simpleGrades.some(g => normalizedGrade.includes(g))) {
    return 'simple';
  }

  if (moderateGrades.some(g => normalizedGrade.includes(g))) {
    return 'moderate';
  }

  return 'advanced';
}

/**
 * Builds the LLM prompt adapted to the learner's grade level.
 * The prompt instructs GPT-5 Mini to generate a structured explanation.
 */
export function buildExplanationPrompt(
  pageText: string,
  gradeLevel: string,
  subject?: string
): string {
  const complexity = getComplexityLevel(gradeLevel);

  const complexityInstructions: Record<ComplexityLevel, string> = {
    simple:
      'Use very simple words and short sentences suitable for young children (ages 4-7). ' +
      'Explain as if talking to a kindergartener or early primary student. ' +
      'Use familiar everyday examples.',
    moderate:
      'Use clear and straightforward language suitable for children (ages 8-10). ' +
      'Explain concepts with relatable examples. ' +
      'Keep sentences moderate in length and vocabulary age-appropriate.',
    advanced:
      'Use precise academic language suitable for secondary school students (ages 11-17). ' +
      'Include relevant technical terms with brief definitions. ' +
      'Provide detailed explanations with logical connections between concepts.',
  };

  const subjectContext = subject ? `\nSubject: ${subject}` : '';

  return `You are an educational content explainer for a ${gradeLevel} grade student.
${complexityInstructions[complexity]}
${subjectContext}

Analyze the following textbook page content and generate an explanation with:
1. A summary (maximum 200 words) that captures the key ideas
2. Between 3 and 10 keywords that are the most important terms
3. Between 1 and 5 concepts that the student should understand

Respond in the following JSON format exactly:
{
  "summary": "your summary here",
  "keywords": ["keyword1", "keyword2", ...],
  "concepts": ["concept1", "concept2", ...]
}

Page content:
${pageText}`;
}

/**
 * Parses the LLM response into a structured explanation.
 * Handles potential formatting issues in the LLM output.
 */
export function parseLLMResponse(response: string): ParsedExplanation {
  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonStr = response.trim();

  // Strip markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.summary || !Array.isArray(parsed.keywords) || !Array.isArray(parsed.concepts)) {
    throw new Error('Invalid LLM response structure: missing required fields');
  }

  return {
    summary: String(parsed.summary),
    keywords: parsed.keywords.map(String),
    concepts: parsed.concepts.map(String),
  };
}

/**
 * Validates that an explanation meets the structural constraints.
 * - Summary: max 200 words
 * - Keywords: 3-10 items
 * - Concepts: 1-5 items
 *
 * Returns the explanation trimmed/adjusted to fit constraints if needed.
 */
export function validateAndNormalizeExplanation(
  explanation: ParsedExplanation
): ParsedExplanation {
  // Enforce summary word limit (max 200 words)
  const words = explanation.summary.split(/\s+/).filter(w => w.length > 0);
  const summary = words.length > 200
    ? words.slice(0, 200).join(' ')
    : explanation.summary;

  // Enforce keyword bounds (3-10)
  let keywords = explanation.keywords;
  if (keywords.length > 10) {
    keywords = keywords.slice(0, 10);
  }
  if (keywords.length < 3) {
    // Pad with generic terms derived from summary if less than 3
    const summaryWords = summary.split(/\s+/).filter(w => w.length > 4);
    while (keywords.length < 3 && summaryWords.length > 0) {
      const word = summaryWords.shift()!;
      if (!keywords.includes(word)) {
        keywords.push(word);
      }
    }
    // Final fallback if still less than 3
    while (keywords.length < 3) {
      keywords.push(`term${keywords.length + 1}`);
    }
  }

  // Enforce concept bounds (1-5)
  let concepts = explanation.concepts;
  if (concepts.length > 5) {
    concepts = concepts.slice(0, 5);
  }
  if (concepts.length < 1) {
    concepts = ['Main concept from the content'];
  }

  return { summary, keywords, concepts };
}

/**
 * Generates the S3 key for an explanation audio file.
 */
export function buildAudioS3Key(
  chapterId: string,
  pageNumber: number,
  learnerId: string
): string {
  return `audio/explanations/${chapterId}/${learnerId}/page-${pageNumber}.mp3`;
}

/**
 * Handles an explanation generation request.
 * Processes each page sequentially:
 * 1. Build grade-adapted prompt
 * 2. Call GPT-5 Mini for explanation
 * 3. Validate output structure
 * 4. Generate TTS audio for the summary
 * 5. Upload audio to S3
 * 6. Return ExplanationResult array
 */
export async function handleExplanationRequest(
  payload: ExplanationRequest,
  deps: ExplanationDeps
): Promise<ExplanationResult[]> {
  const { chapterId, learnerId, gradeLevel, pages, subject, language } = payload;

  const results: ExplanationResult[] = [];

  for (const page of pages) {
    // Step 1: Build the prompt
    const prompt = buildExplanationPrompt(page.text, gradeLevel, subject);

    // Step 2: Call GPT-5 Mini
    const llmResponse = await deps.llmClient.generate(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      model: 'gpt-5-mini',
    });

    // Step 3: Parse and validate
    const parsed = parseLLMResponse(llmResponse);
    const validated = validateAndNormalizeExplanation(parsed);

    // Step 4: Generate TTS audio
    const audioLanguage = page.language || language || 'en';
    const audioBuffer = await deps.ttsClient.synthesize(
      validated.summary,
      audioLanguage
    );

    // Step 5: Upload to S3
    const s3Key = buildAudioS3Key(chapterId, page.pageNumber, learnerId);
    const audioUrl = await deps.s3Client.upload(s3Key, audioBuffer, 'audio/mpeg');

    // Step 6: Build result
    const result: ExplanationResult = {
      pageNumber: page.pageNumber,
      summary: validated.summary,
      keywords: validated.keywords,
      concepts: validated.concepts,
      audioUrl,
    };

    results.push(result);
  }

  return results;
}
