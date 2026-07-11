/**
 * AI API — Typed service layer for AI-powered feature endpoints.
 *
 * Connects Q&A, pronunciation practice, grammar exercises, revision quizzes,
 * and page explanations to the backend AI Gateway Lambda via the API client.
 *
 * Validates: Requirements 9.1, 10.4, 12.2, 19.1, 19.2
 */
import { apiClient } from './apiClient';
import type {
  ExplanationResult,
  PronunciationScore,
  QARequest,
} from '@chikumiku/types';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface QAResponse {
  answer: string;
  sources: string[];
  sessionId: string;
}

export interface GrammarExercise {
  id: string;
  type: 'fill-blank' | 'correction' | 'rewrite' | 'multiple-choice';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GrammarSubmitResponse {
  correct: boolean;
  explanation: string;
  score: number;
}

export interface RevisionQuestion {
  id: string;
  type: 'mcq' | 'true-false' | 'fill-blank' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface RevisionQuizResponse {
  questions: RevisionQuestion[];
  quizId: string;
}

export interface QuizSubmitResponse {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  }>;
}

export interface PronunciationAudioResponse {
  audioUrl: string;
  text: string;
  language: string;
}

// ─── AI API Service ──────────────────────────────────────────────────────────

export const aiApi = {
  // ─── Page Explanations ───────────────────────────────────────────────────

  /**
   * Get AI-generated explanation for a specific page in a chapter.
   */
  async getPageExplanation(
    chapterId: string,
    pageNumber: number,
  ): Promise<ExplanationResult> {
    const { data } = await apiClient.get<ExplanationResult>(
      `/ai/chapters/${chapterId}/pages/${pageNumber}/explanation`,
    );
    return data;
  },

  /**
   * Get explanations for all pages in a chapter (bulk).
   */
  async getChapterExplanations(chapterId: string): Promise<ExplanationResult[]> {
    const { data } = await apiClient.get<ExplanationResult[]>(
      `/ai/chapters/${chapterId}/explanations`,
    );
    return data;
  },

  // ─── Chapter Q&A ─────────────────────────────────────────────────────────

  /**
   * Ask a question about a chapter (uses RAG with pgvector).
   */
  async askQuestion(request: Omit<QARequest, 'gradeLevel'>): Promise<QAResponse> {
    const { data } = await apiClient.post<QAResponse>(
      '/ai/qa/ask',
      request,
    );
    return data;
  },

  /**
   * Get Q&A session history for a chapter.
   */
  async getQAHistory(
    chapterId: string,
    sessionId?: string,
  ): Promise<Array<{ question: string; answer: string }>> {
    const path = sessionId
      ? `/ai/qa/history?chapterId=${chapterId}&sessionId=${sessionId}`
      : `/ai/qa/history?chapterId=${chapterId}`;
    const { data } = await apiClient.get<Array<{ question: string; answer: string }>>(path);
    return data;
  },

  // ─── Pronunciation Practice ──────────────────────────────────────────────

  /**
   * Get TTS audio for a text passage (pronunciation reference).
   */
  async getPronunciationAudio(
    chapterId: string,
    pageNumber: number,
    text: string,
  ): Promise<PronunciationAudioResponse> {
    const { data } = await apiClient.post<PronunciationAudioResponse>(
      '/ai/pronunciation/audio',
      { chapterId, pageNumber, text },
    );
    return data;
  },

  /**
   * Submit a pronunciation recording for scoring.
   * Uses multipart/form-data for the audio blob.
   */
  async submitPronunciation(
    chapterId: string,
    pageNumber: number,
    audioBlob: Blob,
    referenceText: string,
  ): Promise<PronunciationScore> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('chapterId', chapterId);
    formData.append('pageNumber', String(pageNumber));
    formData.append('referenceText', referenceText);

    const token = localStorage.getItem('chikumiku_access_token');
    const { API_BASE_URL } = await import('../config/environment');
    const response = await fetch(`${API_BASE_URL}/ai/pronunciation/score`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: (err as { message?: string }).message || 'Pronunciation scoring failed',
        retryable: response.status >= 500,
      };
    }

    return (await response.json()) as PronunciationScore;
  },

  // ─── Grammar Exercises ───────────────────────────────────────────────────

  /**
   * Get grammar exercises for a chapter.
   */
  async getGrammarExercises(chapterId: string): Promise<GrammarExercise[]> {
    const { data } = await apiClient.get<GrammarExercise[]>(
      `/ai/chapters/${chapterId}/grammar`,
    );
    return data;
  },

  /**
   * Submit a grammar exercise answer for evaluation.
   */
  async submitGrammarAnswer(
    exerciseId: string,
    answer: string,
  ): Promise<GrammarSubmitResponse> {
    const { data } = await apiClient.post<GrammarSubmitResponse>(
      `/ai/grammar/${exerciseId}/submit`,
      { answer },
    );
    return data;
  },

  // ─── Revision Quizzes ────────────────────────────────────────────────────

  /**
   * Generate a revision quiz for a chapter.
   */
  async generateRevisionQuiz(
    chapterId: string,
    questionCount?: number,
  ): Promise<RevisionQuizResponse> {
    const { data } = await apiClient.post<RevisionQuizResponse>(
      '/ai/revision/generate',
      { chapterId, questionCount: questionCount ?? 10 },
    );
    return data;
  },

  /**
   * Submit quiz answers for scoring.
   */
  async submitQuiz(
    quizId: string,
    answers: Array<{ questionId: string; answer: string }>,
  ): Promise<QuizSubmitResponse> {
    const { data } = await apiClient.post<QuizSubmitResponse>(
      `/ai/revision/${quizId}/submit`,
      { answers },
    );
    return data;
  },
};
