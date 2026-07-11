/**
 * Learning service repository interface.
 * Abstracts database operations for testability via dependency injection.
 */

/** Learner record associated with a parent. */
export interface LearnerRecord {
  id: string;
  name: string;
  grade: string;
  subjects: SubjectRecord[];
}

/** Subject record for a learner. */
export interface SubjectRecord {
  id: string;
  name: string;
}

/** Book record within a subject. */
export interface BookRecord {
  id: string;
  subjectId: string;
  name: string;
}

/** Chapter record within a book. */
export interface ChapterRecord {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterName: string;
  totalContentPages: number;
  pagesRead: number;
}

/** Exercise data for a chapter. */
export interface ExerciseRecord {
  chapterId: string;
  totalQuestions: number;
  correctAnswers: number;
}

/** Quiz attempt data for a chapter. */
export interface QuizAttemptRecord {
  chapterId: string;
  totalAttempts: number;
  highestScore: number;
  mostRecentScore: number;
}

/** Interface for learning service database operations. */
export interface ILearningRepository {
  /** Get all learners registered under a parent. */
  getLearnersByParentId(parentId: string): Promise<LearnerRecord[]>;

  /** Get all subjects for a learner. */
  getSubjectsByLearnerId(learnerId: string): Promise<SubjectRecord[]>;

  /** Get all books for a subject belonging to a learner. */
  getBooksBySubjectAndLearner(subjectId: string, learnerId: string): Promise<BookRecord[]>;

  /** Get all chapters for a book. */
  getChaptersByBookId(bookId: string): Promise<ChapterRecord[]>;

  /** Get exercise data for a chapter. */
  getExerciseByChapterId(chapterId: string): Promise<ExerciseRecord | null>;

  /** Get quiz attempts summary for a chapter. */
  getQuizAttemptsByChapterId(chapterId: string): Promise<QuizAttemptRecord | null>;
}
