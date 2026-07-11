/**
 * Field validators for ChikuMiku LearnVerse.
 * Each validator is a pure function that takes input and returns a ValidationResult.
 */
import { ValidationResult } from '@chikumiku/types';

/**
 * Validates a username: 8-15 chars, lowercase letters, digits, underscore, hyphen only.
 */
export function validateUsername(username: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (username.length < 8 || username.length > 15) {
    errors.username = 'Username must be between 8 and 15 characters';
  } else if (!/^[a-z0-9_-]+$/.test(username)) {
    errors.username = 'Username can only contain lowercase letters, digits, underscores, and hyphens';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a full name (also used for learner name): 5-20 chars, letters and spaces only.
 */
export function validateFullName(fullName: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (fullName.length < 5 || fullName.length > 20) {
    errors.fullName = 'Full name must be between 5 and 20 characters';
  } else if (!/^[a-zA-Z ]+$/.test(fullName)) {
    errors.fullName = 'Full name can only contain letters and spaces';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a phone number: exactly 10 digits.
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!/^\d{10}$/.test(phone)) {
    errors.phone = 'Phone number must be exactly 10 digits';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates an email: valid format and max 30 characters.
 */
export function validateEmail(email: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (email.length > 30) {
    errors.email = 'Email must not exceed 30 characters';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Email must be a valid email address';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a password: 8-20 chars, at least 1 uppercase, 1 lowercase, 1 digit,
 * 1 special character from !@#$%^&*.
 */
export function validatePassword(password: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (password.length < 8 || password.length > 20) {
    errors.password = 'Password must be between 8 and 20 characters';
  } else if (!/[A-Z]/.test(password)) {
    errors.password = 'Password must contain at least one uppercase letter';
  } else if (!/[a-z]/.test(password)) {
    errors.password = 'Password must contain at least one lowercase letter';
  } else if (!/\d/.test(password)) {
    errors.password = 'Password must contain at least one digit';
  } else if (!/[!@#$%^&*]/.test(password)) {
    errors.password = 'Password must contain at least one special character (!@#$%^&*)';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a book name: 3-50 chars, letters, digits, spaces, colons, and hyphens.
 */
export function validateBookName(bookName: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (bookName.length < 3 || bookName.length > 50) {
    errors.bookName = 'Book name must be between 3 and 50 characters';
  } else if (!/^[a-zA-Z0-9 :\-]+$/.test(bookName)) {
    errors.bookName = 'Book name can only contain letters, digits, spaces, colons, and hyphens';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a chapter name: 3-100 chars, letters, digits, spaces, colons, and hyphens.
 */
export function validateChapterName(chapterName: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (chapterName.length < 3 || chapterName.length > 100) {
    errors.chapterName = 'Chapter name must be between 3 and 100 characters';
  } else if (!/^[a-zA-Z0-9 :\-]+$/.test(chapterName)) {
    errors.chapterName = 'Chapter name can only contain letters, digits, spaces, colons, and hyphens';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a custom subject name: 1-50 chars, any printable characters.
 */
export function validateSubjectName(subjectName: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (subjectName.length < 1 || subjectName.length > 50) {
    errors.subjectName = 'Subject name must be between 1 and 50 characters';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a school name: 5-30 chars, letters, digits, commas, spaces, and hyphens.
 */
export function validateSchoolName(schoolName: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (schoolName.length < 5 || schoolName.length > 30) {
    errors.schoolName = 'School name must be between 5 and 30 characters';
  } else if (!/^[a-zA-Z0-9, \-]+$/.test(schoolName)) {
    errors.schoolName = 'School name can only contain letters, digits, commas, spaces, and hyphens';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
