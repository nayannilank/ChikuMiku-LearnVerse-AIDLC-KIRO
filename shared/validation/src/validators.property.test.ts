/**
 * Property-based tests for field validators.
 * Feature: chikumiku-learnverse, Property 1: Field Validation Correctness
 *
 * **Validates: Requirements 1.1, 1.3, 2.1, 2.5, 4.2, 6.1, 16.2, 16.3, 17.2, 17.7**
 *
 * For any input string and any field type, the validator SHALL accept the string
 * if and only if it conforms to the field's defined format rules, and reject it
 * with an appropriate error message otherwise.
 */
import * as fc from 'fast-check';
import {
  validateUsername,
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateBookName,
  validateChapterName,
  validateSubjectName,
  validateSchoolName,
} from './validators';

// --- Helper: build string from array of chars ---
function charsToString(charSet: string[], minLen: number, maxLen: number): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...charSet), { minLength: minLen, maxLength: maxLen })
    .map((arr) => arr.join(''));
}

// --- Arbitraries for generating valid inputs ---

/** Username: 8-15 chars from [a-z0-9_-] */
const validUsernameArb = fc.stringMatching(/^[a-z0-9_\-]{8,15}$/);

/** Full name: 5-20 chars from [a-zA-Z ] */
const validFullNameArb = fc.stringMatching(/^[a-zA-Z ]{5,20}$/);

/** Phone: exactly 10 digits */
const validPhoneArb = fc.stringMatching(/^\d{10}$/);

/** Email: valid format matching /^[^\s@]+@[^\s@]+\.[^\s@]+$/, max 30 chars */
const validEmailArb = fc
  .tuple(
    // local part: 1-10 chars, no spaces or @
    charsToString('abcdefghijklmnopqrstuvwxyz0123456789._%-'.split(''), 1, 10),
    // domain name: 1-8 chars
    charsToString('abcdefghijklmnopqrstuvwxyz0123456789'.split(''), 1, 8),
    // TLD: 2-4 chars
    charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 2, 4),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`)
  .filter((email) => email.length <= 30 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

/** Password: 8-20 chars, at least 1 upper, 1 lower, 1 digit, 1 special from !@#$%^&* */
const validPasswordArb = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.constantFrom(...'0123456789'.split('')),
    fc.constantFrom(...'!@#$%^&*'.split('')),
    // Remaining chars (4-16 more) from the full allowed set
    charsToString(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.split(''),
      4,
      16,
    ),
  )
  .map(([upper, lower, digit, special, rest]) => {
    // Place mandatory chars at known positions to guarantee inclusion
    const chars = [upper, lower, digit, special, ...rest.split('')];
    return chars.join('');
  })
  .filter((pw) => {
    return (
      pw.length >= 8 &&
      pw.length <= 20 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /\d/.test(pw) &&
      /[!@#$%^&*]/.test(pw)
    );
  });

/** Book name: 3-50 chars from [a-zA-Z0-9 :-] */
const validBookNameArb = fc.stringMatching(/^[a-zA-Z0-9 :\-]{3,50}$/);

/** Chapter name: 3-100 chars from [a-zA-Z0-9 :-] */
const validChapterNameArb = fc.stringMatching(/^[a-zA-Z0-9 :\-]{3,50}$/);

/** Subject name: 1-50 chars, any characters */
const validSubjectNameArb = fc.string({ minLength: 1, maxLength: 50 });

/** School name: 5-30 chars from [a-zA-Z0-9, -] */
const validSchoolNameArb = fc.stringMatching(/^[a-zA-Z0-9, \-]{5,30}$/);

// --- Arbitraries for generating invalid inputs ---

/** Generates a string that violates username rules (wrong length OR wrong chars) */
const invalidUsernameArb = fc.oneof(
  // Too short
  charsToString('abcdefghijklmnopqrstuvwxyz0123456789_-'.split(''), 0, 7),
  // Too long
  charsToString('abcdefghijklmnopqrstuvwxyz0123456789_-'.split(''), 16, 30),
  // Correct length but invalid chars (uppercase/special)
  fc
    .tuple(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%'.split('')),
      charsToString('abcdefghijklmnopqrstuvwxyz0123456789_-'.split(''), 7, 14),
    )
    .map(([bad, rest]) => bad + rest),
);

/** Generates a string that violates full name rules */
const invalidFullNameArb = fc.oneof(
  // Too short
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split(''), 0, 4),
  // Too long
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split(''), 21, 40),
  // Correct length but invalid chars (digits/special)
  fc
    .tuple(
      fc.constantFrom(...'0123456789!@#$'.split('')),
      charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split(''), 4, 19),
    )
    .map(([bad, rest]) => bad + rest),
);

/** Generates invalid phone numbers */
const invalidPhoneArb = fc.oneof(
  // Wrong length (too short)
  charsToString('0123456789'.split(''), 0, 9),
  // Wrong length (too long)
  charsToString('0123456789'.split(''), 11, 20),
  // Correct length but non-digit chars
  fc
    .tuple(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz!@#$%'.split('')),
      charsToString('0123456789'.split(''), 9, 9),
    )
    .map(([bad, rest]) => bad + rest),
);

/** Generates invalid emails */
const invalidEmailArb = fc.oneof(
  // No @ sign
  charsToString('abcdefghijklmnopqrstuvwxyz0123456789'.split(''), 1, 20),
  // Too long (> 30 chars)
  fc
    .tuple(
      charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 15, 20),
      charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 5, 10),
    )
    .map(([local, domain]) => `${local}@${domain}.com`)
    .filter((email) => email.length > 30),
  // Missing dot after @
  fc
    .tuple(
      charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 1, 5),
      charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 1, 5),
    )
    .map(([local, domain]) => `${local}@${domain}`),
);

/** Generates invalid passwords */
const invalidPasswordArb = fc.oneof(
  // Too short
  fc.string({ minLength: 1, maxLength: 7 }),
  // Too long
  fc.string({ minLength: 21, maxLength: 30 }),
  // Correct length but missing uppercase
  charsToString('abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.split(''), 8, 20).filter(
    (pw) => !/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[!@#$%^&*]/.test(pw),
  ),
  // Correct length but missing lowercase
  charsToString('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'.split(''), 8, 20).filter(
    (pw) => /[A-Z]/.test(pw) && !/[a-z]/.test(pw) && /\d/.test(pw) && /[!@#$%^&*]/.test(pw),
  ),
  // Correct length but missing digit
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*'.split(''), 8, 20).filter(
    (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) && !/\d/.test(pw) && /[!@#$%^&*]/.test(pw),
  ),
  // Correct length but missing special
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''), 8, 20).filter(
    (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && !/[!@#$%^&*]/.test(pw),
  ),
);

/** Generates invalid book names */
const invalidBookNameArb = fc.oneof(
  // Too short
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :-'.split(''), 0, 2),
  // Too long
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :-'.split(''), 51, 60),
  // Correct length but invalid chars
  fc
    .tuple(
      fc.constantFrom(...'!@#$%^&*()+=[]{}|'.split('')),
      charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :-'.split(''), 2, 49),
    )
    .map(([bad, rest]) => bad + rest),
);

/** Generates invalid chapter names */
const invalidChapterNameArb = fc.oneof(
  // Too short
  charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 0, 2),
  // Too long
  charsToString('abcdefghijklmnopqrstuvwxyz'.split(''), 101, 110),
  // Correct length but invalid chars
  fc
    .tuple(
      fc.constantFrom(...'!@#$%^&*()+=[]{}|'.split('')),
      charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :-'.split(''), 2, 99),
    )
    .map(([bad, rest]) => bad + rest),
);

/** Generates invalid subject names (empty or too long) */
const invalidSubjectNameArb = fc.oneof(
  fc.constant(''), // empty
  fc.string({ minLength: 51, maxLength: 70 }), // too long
);

/** Generates invalid school names */
const invalidSchoolNameArb = fc.oneof(
  // Too short
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789, -'.split(''), 0, 4),
  // Too long
  charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789, -'.split(''), 31, 40),
  // Correct length but invalid chars
  fc
    .tuple(
      fc.constantFrom(...'!@#$%^&*()+=[]{}|'.split('')),
      charsToString('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789, -'.split(''), 4, 29),
    )
    .map(([bad, rest]) => bad + rest),
);

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 1: Field Validation Correctness', () => {
  describe('validateUsername', () => {
    it('accepts all valid usernames (8-15 chars, [a-z0-9_-])', () => {
      fc.assert(
        fc.property(validUsernameArb, (username: string) => {
          const result = validateUsername(username);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid usernames with appropriate error key', () => {
      fc.assert(
        fc.property(invalidUsernameArb, (username: string) => {
          const result = validateUsername(username);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('username');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateFullName', () => {
    it('accepts all valid full names (5-20 chars, [a-zA-Z ])', () => {
      fc.assert(
        fc.property(validFullNameArb, (fullName: string) => {
          const result = validateFullName(fullName);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid full names with appropriate error key', () => {
      fc.assert(
        fc.property(invalidFullNameArb, (fullName: string) => {
          const result = validateFullName(fullName);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('fullName');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validatePhone', () => {
    it('accepts all valid phone numbers (exactly 10 digits)', () => {
      fc.assert(
        fc.property(validPhoneArb, (phone: string) => {
          const result = validatePhone(phone);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid phone numbers with appropriate error key', () => {
      fc.assert(
        fc.property(invalidPhoneArb, (phone: string) => {
          const result = validatePhone(phone);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('phone');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateEmail', () => {
    it('accepts all valid emails (format + max 30 chars)', () => {
      fc.assert(
        fc.property(validEmailArb, (email: string) => {
          const result = validateEmail(email);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid emails with appropriate error key', () => {
      fc.assert(
        fc.property(invalidEmailArb, (email: string) => {
          const result = validateEmail(email);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('email');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validatePassword', () => {
    it('accepts all valid passwords (8-20 chars, 1 upper, 1 lower, 1 digit, 1 special)', () => {
      fc.assert(
        fc.property(validPasswordArb, (password: string) => {
          const result = validatePassword(password);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid passwords with appropriate error key', () => {
      fc.assert(
        fc.property(invalidPasswordArb, (password: string) => {
          const result = validatePassword(password);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('password');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateBookName', () => {
    it('accepts all valid book names (3-50 chars, [a-zA-Z0-9 :-])', () => {
      fc.assert(
        fc.property(validBookNameArb, (bookName: string) => {
          const result = validateBookName(bookName);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid book names with appropriate error key', () => {
      fc.assert(
        fc.property(invalidBookNameArb, (bookName: string) => {
          const result = validateBookName(bookName);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('bookName');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateChapterName', () => {
    it('accepts all valid chapter names (3-100 chars, [a-zA-Z0-9 :-])', () => {
      fc.assert(
        fc.property(validChapterNameArb, (chapterName: string) => {
          const result = validateChapterName(chapterName);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid chapter names with appropriate error key', () => {
      fc.assert(
        fc.property(invalidChapterNameArb, (chapterName: string) => {
          const result = validateChapterName(chapterName);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('chapterName');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateSubjectName', () => {
    it('accepts all valid subject names (1-50 chars, any characters)', () => {
      fc.assert(
        fc.property(validSubjectNameArb, (subjectName: string) => {
          const result = validateSubjectName(subjectName);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid subject names with appropriate error key', () => {
      fc.assert(
        fc.property(invalidSubjectNameArb, (subjectName: string) => {
          const result = validateSubjectName(subjectName);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('subjectName');
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('validateSchoolName', () => {
    it('accepts all valid school names (5-30 chars, [a-zA-Z0-9, -])', () => {
      fc.assert(
        fc.property(validSchoolNameArb, (schoolName: string) => {
          const result = validateSchoolName(schoolName);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }),
        { numRuns: 200 },
      );
    });

    it('rejects all invalid school names with appropriate error key', () => {
      fc.assert(
        fc.property(invalidSchoolNameArb, (schoolName: string) => {
          const result = validateSchoolName(schoolName);
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('schoolName');
        }),
        { numRuns: 200 },
      );
    });
  });
});
