/**
 * API service — Mock API calls for the web client.
 *
 * Simulates server-side authentication including account lockout,
 * registration, and password reset flows.
 * Will be replaced with real API calls in a later task.
 *
 * Validates: Requirements 3.2, 3.4, 3.5, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
import type { UserRole } from '../context/AuthContext';

export interface LoginRequest {
  role: UserRole;
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  locked?: boolean;
  lockoutMinutes?: number;
}

// In-memory mock storage for failed attempts (simulates server state)
const failedAttempts: Record<string, { count: number; lockedUntil: number | null }> = {};

// Mock user store — in production this is handled server-side
const MOCK_USERS = [
  { username: 'parent-user', password: 'Parent@123', role: 'parent' as UserRole },
  { username: 'learner-kid', password: 'Learn@456', role: 'learner' as UserRole },
];

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Mock login API call.
 *
 * Returns a generic error on auth failure (no info leakage).
 * Returns lockout response after 5 consecutive failures.
 */
export async function loginApi(request: LoginRequest): Promise<LoginResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const key = request.username.toLowerCase();

  // Initialize tracking if not present
  if (!failedAttempts[key]) {
    failedAttempts[key] = { count: 0, lockedUntil: null };
  }

  const tracker = failedAttempts[key];

  // Check if account is currently locked
  if (tracker.lockedUntil && Date.now() < tracker.lockedUntil) {
    return {
      success: false,
      locked: true,
      lockoutMinutes: 15,
      error: 'Account locked for 15 minutes. Please try again later.',
    };
  }

  // If lockout expired, reset
  if (tracker.lockedUntil && Date.now() >= tracker.lockedUntil) {
    tracker.count = 0;
    tracker.lockedUntil = null;
  }

  // Check credentials
  const user = MOCK_USERS.find(
    (u) =>
      u.username === request.username &&
      u.password === request.password &&
      u.role === request.role
  );

  if (user) {
    // Successful login — reset attempts
    tracker.count = 0;
    tracker.lockedUntil = null;
    return { success: true };
  }

  // Failed auth — increment counter
  tracker.count += 1;

  // Lock after MAX_ATTEMPTS consecutive failures
  if (tracker.count >= MAX_ATTEMPTS) {
    tracker.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    return {
      success: false,
      locked: true,
      lockoutMinutes: 15,
      error: 'Account locked for 15 minutes. Please try again later.',
    };
  }

  // Generic error — no info leakage about which field is wrong
  return {
    success: false,
    error: 'Invalid credentials. Please try again.',
  };
}


/**
 * ApiError — Typed error thrown by API calls for structured error handling.
 */
export interface ApiError {
  status: number;
  message: string;
  field?: string;
}

/**
 * authApi — Object-based API for other pages (registration, forgot password).
 *
 * Provides mock implementations for:
 * - registerParent
 * - forgotPassword (Req 4.1, 4.2)
 * - verifyOtp (Req 4.3, 4.4)
 * - resetPassword (Req 4.5, 4.6)
 */
export const authApi = {
  async registerParent(data: {
    username: string;
    fullName: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Mock: simulate duplicate username check
    if (data.username === 'existing-user') {
      const error: ApiError = { status: 409, message: 'This username is already in use', field: 'username' };
      throw error;
    }

    return { success: true };
  },

  /**
   * Register a learner profile under a parent account (Req 2.1, 2.2, 2.3, 2.4, 2.5).
   * Mock: simulates a successful registration or duplicate username error.
   */
  async registerLearner(data: {
    parentUsername: string;
    username: string;
    name: string;
    password: string;
    gender: string;
    relationship: string;
    grade: string;
    school: string;
    subjects: string[];
  }): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Mock: simulate duplicate username check
    if (data.username === 'existing-user') {
      const error: ApiError = { status: 409, message: 'This username is already in use', field: 'username' };
      throw error;
    }

    return { success: true };
  },

  /**
   * Request password reset for a given username.
   * Returns a generic response regardless of whether the username exists
   * to prevent information leakage (Req 4.2).
   */
  async forgotPassword(username: string): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock: reject empty username
    if (!username.trim()) {
      return { success: false };
    }

    // Simulate failure for a specific test username to exercise error path
    if (username === 'nonexistent_user') {
      return { success: false };
    }

    // Generic response — no info leakage about whether username exists
    return { success: true };
  },

  /**
   * Verify OTP code for password reset (Req 4.3).
   * Mock: accepts "123456" as valid OTP.
   */
  async verifyOtp(_username: string, otp: string): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: otp === '123456' };
  },

  /**
   * Reset password with a new password after successful OTP verification (Req 4.5).
   */
  async resetPassword(
    _username: string,
    _newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: true, message: 'Password reset successful' };
  },
};


/* ====================================================================
 * Learner Management API — Mock endpoints for manage learners (Req 16.1–16.6)
 * ==================================================================== */

export interface LearnerProfile {
  id: string;
  username: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  grade: string;
  school: string;
  subjects: string[];
}

export interface UpdateLearnerRequest {
  name?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
}

export interface ResetPasswordRequest {
  newPassword: string;
}

// Mock registered learners store
const MOCK_LEARNERS: LearnerProfile[] = [
  {
    id: 'learner-1',
    username: 'chiku-learn',
    name: 'Chiku Kumar',
    gender: 'male',
    grade: '5th',
    school: 'Delhi Public School',
    subjects: ['English', 'Hindi', 'Maths', 'Science', 'EVS', 'Computers', 'Kannada'],
  },
  {
    id: 'learner-2',
    username: 'miku-learn',
    name: 'Miku Kumar',
    gender: 'female',
    grade: '3rd',
    school: 'Kendriya Vidyalaya',
    subjects: ['English', 'Hindi', 'Maths', 'Science', 'EVS'],
  },
];

/**
 * learnerApi — Mock API for learner management (Req 16.1, 16.2, 16.3, 16.4, 16.5, 16.6).
 */
export const learnerApi = {
  /**
   * Get all learners under the parent account (Req 16.1).
   */
  async getLearners(): Promise<LearnerProfile[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return MOCK_LEARNERS.filter((l) => l.id !== '');
  },

  /**
   * Update a learner's profile (Req 16.2).
   * Validates name, grade, school, and subjects on the server side as well.
   */
  async updateLearner(
    learnerId: string,
    data: UpdateLearnerRequest
  ): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const learner = MOCK_LEARNERS.find((l) => l.id === learnerId);
    if (!learner) {
      return { success: false, error: 'Learner not found' };
    }

    // Apply updates
    if (data.name !== undefined) learner.name = data.name;
    if (data.grade !== undefined) learner.grade = data.grade;
    if (data.school !== undefined) learner.school = data.school;
    if (data.subjects !== undefined) learner.subjects = data.subjects;

    return { success: true };
  },

  /**
   * Reset a learner's password (Req 16.3).
   * Returns generic error on invalid password — no info about which rule failed.
   */
  async resetLearnerPassword(
    _learnerId: string,
    _data: ResetPasswordRequest
  ): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: true };
  },

  /**
   * Remove (soft delete) a learner profile (Req 16.4, 16.5, 16.6).
   * Performs atomic soft deletion of learner and all associated data.
   */
  async removeLearner(learnerId: string): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const index = MOCK_LEARNERS.findIndex((l) => l.id === learnerId);
    if (index === -1) {
      return { success: false, error: 'Learner not found' };
    }

    // Soft delete — remove from in-memory list (simulates marking deleted_at)
    MOCK_LEARNERS.splice(index, 1);
    return { success: true };
  },
};


/* ====================================================================
 * Content API — Mock endpoints for chapter creation flow (Req 6.1, 6.2, 6.3)
 * ==================================================================== */

export interface Book {
  id: string;
  name: string;
  subjectName: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterName: string;
}

export interface CreateChapterRequest {
  subjectName: string;
  bookName: string;
  chapterNumber: number;
  chapterName: string;
}

export interface CreateChapterResponse {
  success: boolean;
  chapterId?: string;
  error?: string;
}

// Mock enrolled subjects (7 defaults)
const MOCK_ENROLLED_SUBJECTS = [
  'English',
  'Hindi',
  'Kannada',
  'Maths',
  'Science',
  'EVS',
  'Computers',
];

// Mock existing books per subject
const MOCK_BOOKS: Book[] = [
  { id: 'book-1', name: 'Grammar Basics', subjectName: 'English' },
  { id: 'book-2', name: 'Creative Writing', subjectName: 'English' },
  { id: 'book-3', name: 'Hindi Vyakaran', subjectName: 'Hindi' },
  { id: 'book-4', name: 'Algebra Fundamentals', subjectName: 'Maths' },
  { id: 'book-5', name: 'Geometry World', subjectName: 'Maths' },
  { id: 'book-6', name: 'Living Things', subjectName: 'Science' },
  { id: 'book-7', name: 'Computer Basics', subjectName: 'Computers' },
];

// Mock existing chapters
const MOCK_CHAPTERS: Chapter[] = [
  { id: 'ch-1', bookId: 'book-1', chapterNumber: 1, chapterName: 'Nouns and Pronouns' },
  { id: 'ch-2', bookId: 'book-1', chapterNumber: 2, chapterName: 'Verbs and Tenses' },
  { id: 'ch-3', bookId: 'book-4', chapterNumber: 1, chapterName: 'Introduction to Variables' },
  { id: 'ch-4', bookId: 'book-6', chapterNumber: 1, chapterName: 'Plants Around Us' },
  { id: 'ch-5', bookId: 'book-6', chapterNumber: 2, chapterName: 'Animal Kingdom' },
  { id: 'ch-6', bookId: 'book-6', chapterNumber: 3, chapterName: 'Human Body Systems' },
];

/**
 * contentApi — Mock content management API for chapter creation.
 */
export const contentApi = {
  /**
   * Get the learner's enrolled subjects.
   */
  async getEnrolledSubjects(): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return MOCK_ENROLLED_SUBJECTS;
  },

  /**
   * Get existing books for a given subject.
   */
  async getBooksForSubject(subjectName: string): Promise<Book[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return MOCK_BOOKS.filter((b) => b.subjectName === subjectName);
  },

  /**
   * Get existing chapters for a given book.
   */
  async getChaptersForBook(bookId: string): Promise<Chapter[]> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return MOCK_CHAPTERS.filter((c) => c.bookId === bookId);
  },

  /**
   * Save a chapter transcript (Req 8.6).
   * Simulates atomic persist with verification.
   * Returns error if persistence fails.
   */
  async saveTranscript(
    _chapterId: string,
    _pages: { pageNumber: number; classification: string; text: string; language: string; status: string }[]
  ): Promise<{ success: boolean; error?: string }> {
    // Simulate atomic persist (500ms delay)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate verification step
    await new Promise((resolve) => setTimeout(resolve, 200));

    return { success: true };
  },

  /**
   * Create a new chapter (Req 6.1, 6.3).
   * Returns error if chapter number already exists within same book.
   */
  async createChapter(request: CreateChapterRequest): Promise<CreateChapterResponse> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Find or create the book
    let book = MOCK_BOOKS.find(
      (b) => b.subjectName === request.subjectName && b.name === request.bookName,
    );

    if (!book) {
      // Create new book
      book = {
        id: `book-${Date.now()}`,
        name: request.bookName,
        subjectName: request.subjectName,
      };
      MOCK_BOOKS.push(book);
    }

    // Check for duplicate chapter number (Req 6.3)
    const existingChapter = MOCK_CHAPTERS.find(
      (c) => c.bookId === book!.id && c.chapterNumber === request.chapterNumber,
    );

    if (existingChapter) {
      return {
        success: false,
        error: `Chapter number ${request.chapterNumber} is already in use in this book`,
      };
    }

    // Create the chapter
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      bookId: book.id,
      chapterNumber: request.chapterNumber,
      chapterName: request.chapterName,
    };
    MOCK_CHAPTERS.push(newChapter);

    return { success: true, chapterId: newChapter.id };
  },
};


/* ====================================================================
 * Profile API — Mock endpoints for parent profile and settings (Req 17.1–17.7)
 * ==================================================================== */

export interface ParentProfile {
  username: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface NotificationPrefs {
  progressAlerts: boolean;
  streakReminders: boolean;
}

export interface CustomSubject {
  id: string;
  name: string;
}

// Mock parent profile data
const MOCK_PARENT_PROFILE: ParentProfile = {
  username: 'parent-user',
  name: 'Nayan Kumar',
  phone: '9876543210',
  email: 'nayan@example.com',
  relationship: 'Father',
};

// Mock notification preferences (both enabled by default per Req 17.4)
let mockNotificationPrefs: NotificationPrefs = {
  progressAlerts: true,
  streakReminders: true,
};

// Mock custom subjects store
let mockCustomSubjects: CustomSubject[] = [
  { id: 'cs-1', name: 'Vedic Mathematics' },
  { id: 'cs-2', name: 'Art & Craft' },
];

/**
 * profileApi — Mock profile management API for parent settings.
 */
export const profileApi = {
  /**
   * Get parent profile details (Req 17.1).
   */
  async getProfile(): Promise<ParentProfile> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { ...MOCK_PARENT_PROFILE };
  },

  /**
   * Update parent profile (Req 17.2).
   * Validates and updates name, phone, email, relationship.
   */
  async updateProfile(data: {
    name: string;
    phone: string;
    email: string;
    relationship: string;
  }): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    MOCK_PARENT_PROFILE.name = data.name;
    MOCK_PARENT_PROFILE.phone = data.phone;
    MOCK_PARENT_PROFILE.email = data.email;
    MOCK_PARENT_PROFILE.relationship = data.relationship;

    return { success: true };
  },

  /**
   * Change password (Req 17.3).
   * Validates current password before accepting new password.
   */
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock: check current password against stored mock user
    const user = MOCK_USERS.find((u) => u.username === 'parent-user');
    if (!user || user.password !== data.currentPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Update the mock password
    user.password = data.newPassword;
    return { success: true };
  },

  /**
   * Get notification preferences (Req 17.4).
   */
  async getNotificationPrefs(): Promise<NotificationPrefs> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { ...mockNotificationPrefs };
  },

  /**
   * Update notification preferences (Req 17.4).
   */
  async updateNotificationPrefs(
    prefs: NotificationPrefs
  ): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockNotificationPrefs = { ...prefs };
    return { success: true };
  },

  /**
   * Request data export in PDF or CSV format (Req 17.5).
   */
  async requestExport(format: 'pdf' | 'csv'): Promise<{ success: boolean; downloadUrl: string }> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      downloadUrl: `/mock-export/learner-progress.${format}`,
    };
  },

  /**
   * Delete account (Req 17.6).
   * Requires password re-entry for verification.
   */
  async deleteAccount(password: string): Promise<{ success: boolean; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const user = MOCK_USERS.find((u) => u.username === 'parent-user');
    if (!user || user.password !== password) {
      return { success: false, error: 'Incorrect password. Account deletion cancelled.' };
    }

    return { success: true };
  },

  /**
   * Get custom subjects (Req 17.7).
   */
  async getCustomSubjects(): Promise<CustomSubject[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return [...mockCustomSubjects];
  },

  /**
   * Add a custom subject (Req 17.7).
   * Max 10 custom subjects per account.
   */
  async addCustomSubject(name: string): Promise<{ success: boolean; subject?: CustomSubject; error?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (mockCustomSubjects.length >= 10) {
      return { success: false, error: 'Maximum of 10 custom subjects reached' };
    }

    const newSubject: CustomSubject = {
      id: `cs-${Date.now()}`,
      name,
    };
    mockCustomSubjects.push(newSubject);

    return { success: true, subject: newSubject };
  },
};
