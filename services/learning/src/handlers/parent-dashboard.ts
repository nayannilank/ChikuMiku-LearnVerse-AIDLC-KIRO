/**
 * Parent Dashboard Handler
 * GET /learn/dashboard/parent
 *
 * Builds tree: Learner → Subject → Book → Chapter (floor % completion) → Exercise (floor %) → Quizzes
 * Returns empty state with 0% and empty children when no content exists.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { APIError, DashboardTreeNode } from '@chikumiku/types';
import { calculateParentCompletion, calculateExerciseCompletion } from '@chikumiku/validation';
import type { ILearningRepository } from '../repositories/learning-repository';

export interface ParentDashboardResponse {
  success: true;
  tree: DashboardTreeNode[];
}

export interface ParentDashboardDeps {
  learningRepository: ILearningRepository;
}

/**
 * Handles the parent dashboard request.
 * Builds the full tree hierarchy with floor-based completion percentages.
 */
export async function handleParentDashboard(
  parentId: string,
  deps: ParentDashboardDeps
): Promise<ParentDashboardResponse | APIError> {
  if (!parentId || parentId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Parent ID is required',
      retryable: false,
    };
  }

  const learners = await deps.learningRepository.getLearnersByParentId(parentId);

  const tree: DashboardTreeNode[] = [];

  for (const learner of learners) {
    const learnerNode: DashboardTreeNode = {
      id: learner.id,
      type: 'learner',
      name: learner.name,
      completionPercentage: 0,
      children: [],
    };

    const subjects = await deps.learningRepository.getSubjectsByLearnerId(learner.id);

    for (const subject of subjects) {
      const subjectNode: DashboardTreeNode = {
        id: subject.id,
        type: 'subject',
        name: subject.name,
        completionPercentage: 0,
        children: [],
      };

      const books = await deps.learningRepository.getBooksBySubjectAndLearner(subject.id, learner.id);

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
          const chapterCompletion = calculateParentCompletion(
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
            ? calculateExerciseCompletion(exercise.correctAnswers, exercise.totalQuestions)
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

        // Book completion = average of chapter completions
        if (bookNode.children!.length > 0) {
          const totalCompletion = bookNode.children!.reduce(
            (sum, ch) => sum + ch.completionPercentage, 0
          );
          bookNode.completionPercentage = Math.floor(
            totalCompletion / bookNode.children!.length
          );
        }

        subjectNode.children!.push(bookNode);
      }

      // Subject completion = average of book completions
      if (subjectNode.children!.length > 0) {
        const totalCompletion = subjectNode.children!.reduce(
          (sum, b) => sum + b.completionPercentage, 0
        );
        subjectNode.completionPercentage = Math.floor(
          totalCompletion / subjectNode.children!.length
        );
      }

      learnerNode.children!.push(subjectNode);
    }

    // Learner completion = average of subject completions
    if (learnerNode.children!.length > 0) {
      const totalCompletion = learnerNode.children!.reduce(
        (sum, s) => sum + s.completionPercentage, 0
      );
      learnerNode.completionPercentage = Math.floor(
        totalCompletion / learnerNode.children!.length
      );
    }

    tree.push(learnerNode);
  }

  return {
    success: true,
    tree,
  };
}
