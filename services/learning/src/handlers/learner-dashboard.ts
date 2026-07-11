/**
 * Learner Dashboard Handler
 * GET /learn/dashboard/learner
 *
 * Builds tree: Subject → Book → Chapter (round % completion) → Exercise (round %) → Quizzes
 * Returns empty state with 0% and empty children when no content exists.
 *
 * Requirements: 15.1, 15.2, 15.6
 */

import type { APIError, DashboardTreeNode } from '@chikumiku/types';
import { calculateLearnerCompletion } from '@chikumiku/validation';
import type { ILearningRepository } from '../repositories/learning-repository';

export interface LearnerDashboardResponse {
  success: true;
  tree: DashboardTreeNode[];
}

export interface LearnerDashboardDeps {
  learningRepository: ILearningRepository;
}

/**
 * Calculates exercise completion using round-based percentage for learner view.
 * Returns 0 if total <= 0. Clamps correct to [0, total].
 */
function calculateLearnerExerciseCompletion(correct: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(correct, total));
  return Math.round((clamped / total) * 100);
}

/**
 * Handles the learner dashboard request.
 * Builds the full tree hierarchy with round-based completion percentages.
 */
export async function handleLearnerDashboard(
  learnerId: string,
  deps: LearnerDashboardDeps
): Promise<LearnerDashboardResponse | APIError> {
  if (!learnerId || learnerId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Learner ID is required',
      retryable: false,
    };
  }

  const subjects = await deps.learningRepository.getSubjectsByLearnerId(learnerId);

  const tree: DashboardTreeNode[] = [];

  for (const subject of subjects) {
    const subjectNode: DashboardTreeNode = {
      id: subject.id,
      type: 'subject',
      name: subject.name,
      completionPercentage: 0,
      children: [],
    };

    const books = await deps.learningRepository.getBooksBySubjectAndLearner(subject.id, learnerId);

    for (const book of books) {
      const bookNode: DashboardTreeNode = {
        id: book.id,
        type: 'book',
        name: book.name,
        completionPercentage: 0,
        children: [],
      };

      const chapters = await deps.learningRepository.getChaptersByBookId(book.id);

      for (const chapter of chapters) {
        const chapterCompletion = calculateLearnerCompletion(
          chapter.pagesRead,
          chapter.totalContentPages
        );

        const chapterNode: DashboardTreeNode = {
          id: chapter.id,
          type: 'chapter',
          name: chapter.chapterName,
          completionPercentage: chapterCompletion,
          children: [],
        };

        // Exercise node
        const exercise = await deps.learningRepository.getExerciseByChapterId(chapter.id);
        const exerciseCompletion = exercise
          ? calculateLearnerExerciseCompletion(exercise.correctAnswers, exercise.totalQuestions)
          : 0;

        const exerciseNode: DashboardTreeNode = {
          id: `${chapter.id}-exercise`,
          type: 'exercise',
          name: 'Exercises',
          completionPercentage: exerciseCompletion,
          children: [],
        };

        // Quiz node
        const quizAttempts = await deps.learningRepository.getQuizAttemptsByChapterId(chapter.id);
        const quizNode: DashboardTreeNode = {
          id: `${chapter.id}-quiz`,
          type: 'quiz',
          name: 'Quizzes',
          completionPercentage: quizAttempts ? quizAttempts.highestScore : 0,
          children: [],
        };

        exerciseNode.children!.push(quizNode);
        chapterNode.children!.push(exerciseNode);
        bookNode.children!.push(chapterNode);
      }

      // Book completion = average of chapter completions (rounded)
      if (bookNode.children!.length > 0) {
        const totalCompletion = bookNode.children!.reduce(
          (sum, ch) => sum + ch.completionPercentage, 0
        );
        bookNode.completionPercentage = Math.round(
          totalCompletion / bookNode.children!.length
        );
      }

      subjectNode.children!.push(bookNode);
    }

    // Subject completion = average of book completions (rounded)
    if (subjectNode.children!.length > 0) {
      const totalCompletion = subjectNode.children!.reduce(
        (sum, b) => sum + b.completionPercentage, 0
      );
      subjectNode.completionPercentage = Math.round(
        totalCompletion / subjectNode.children!.length
      );
    }

    tree.push(subjectNode);
  }

  return {
    success: true,
    tree,
  };
}
