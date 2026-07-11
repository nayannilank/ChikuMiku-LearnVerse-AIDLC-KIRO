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

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('john_doe1')).toEqual({ valid: true, errors: {} });
    expect(validateUsername('user-name')).toEqual({ valid: true, errors: {} });
    expect(validateUsername('ab12cd34ef')).toEqual({ valid: true, errors: {} });
  });

  it('rejects usernames shorter than 8 characters', () => {
    const result = validateUsername('short');
    expect(result.valid).toBe(false);
    expect(result.errors.username).toContain('between 8 and 15');
  });

  it('rejects usernames longer than 15 characters', () => {
    const result = validateUsername('thisusernameistoolong');
    expect(result.valid).toBe(false);
    expect(result.errors.username).toContain('between 8 and 15');
  });

  it('rejects uppercase characters', () => {
    const result = validateUsername('UserName1');
    expect(result.valid).toBe(false);
    expect(result.errors.username).toContain('lowercase');
  });

  it('rejects special characters not in allowed set', () => {
    const result = validateUsername('user@nam');
    expect(result.valid).toBe(false);
    expect(result.errors.username).toContain('lowercase');
  });
});

describe('validateFullName', () => {
  it('accepts valid full names', () => {
    expect(validateFullName('John Doe')).toEqual({ valid: true, errors: {} });
    expect(validateFullName('Nayan Kumar')).toEqual({ valid: true, errors: {} });
  });

  it('rejects names shorter than 5 characters', () => {
    const result = validateFullName('Joe');
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toContain('between 5 and 20');
  });

  it('rejects names longer than 20 characters', () => {
    const result = validateFullName('A Very Long Full Name Here');
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toContain('between 5 and 20');
  });

  it('rejects names with digits', () => {
    const result = validateFullName('John123');
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toContain('letters and spaces');
  });
});

describe('validatePhone', () => {
  it('accepts valid 10-digit phone numbers', () => {
    expect(validatePhone('9876543210')).toEqual({ valid: true, errors: {} });
  });

  it('rejects numbers with fewer than 10 digits', () => {
    const result = validatePhone('12345');
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toContain('exactly 10 digits');
  });

  it('rejects numbers with more than 10 digits', () => {
    const result = validatePhone('12345678901');
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toContain('exactly 10 digits');
  });

  it('rejects non-digit characters', () => {
    const result = validatePhone('98765abcde');
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toContain('exactly 10 digits');
  });
});

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true, errors: {} });
    expect(validateEmail('test.name@domain.co')).toEqual({ valid: true, errors: {} });
  });

  it('rejects emails exceeding 30 characters', () => {
    const result = validateEmail('verylongemailaddress@longdomain.com');
    expect(result.valid).toBe(false);
    expect(result.errors.email).toContain('30 characters');
  });

  it('rejects invalid email format', () => {
    const result = validateEmail('notanemail');
    expect(result.valid).toBe(false);
    expect(result.errors.email).toContain('valid email');
  });

  it('rejects email without domain', () => {
    const result = validateEmail('user@');
    expect(result.valid).toBe(false);
    expect(result.errors.email).toContain('valid email');
  });
});

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('Abcd1234!')).toEqual({ valid: true, errors: {} });
    expect(validatePassword('StrongP@ss1')).toEqual({ valid: true, errors: {} });
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('between 8 and 20');
  });

  it('rejects passwords longer than 20 characters', () => {
    const result = validatePassword('Abcdefghijk1234567!@#');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('between 8 and 20');
  });

  it('rejects passwords without uppercase', () => {
    const result = validatePassword('abcd1234!');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('uppercase');
  });

  it('rejects passwords without lowercase', () => {
    const result = validatePassword('ABCD1234!');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('lowercase');
  });

  it('rejects passwords without digit', () => {
    const result = validatePassword('Abcdefgh!');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('digit');
  });

  it('rejects passwords without special character', () => {
    const result = validatePassword('Abcd12345');
    expect(result.valid).toBe(false);
    expect(result.errors.password).toContain('special character');
  });
});

describe('validateBookName', () => {
  it('accepts valid book names', () => {
    expect(validateBookName('Math: Grade 5')).toEqual({ valid: true, errors: {} });
    expect(validateBookName('Science - Part 1')).toEqual({ valid: true, errors: {} });
  });

  it('rejects names shorter than 3 characters', () => {
    const result = validateBookName('AB');
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toContain('between 3 and 50');
  });

  it('rejects names longer than 50 characters', () => {
    const result = validateBookName('A'.repeat(51));
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toContain('between 3 and 50');
  });

  it('rejects invalid characters', () => {
    const result = validateBookName('Book @Name');
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toContain('letters, digits, spaces, colons, and hyphens');
  });
});

describe('validateChapterName', () => {
  it('accepts valid chapter names', () => {
    expect(validateChapterName('Chapter 1: Introduction')).toEqual({ valid: true, errors: {} });
    expect(validateChapterName('Unit 2 - Fractions')).toEqual({ valid: true, errors: {} });
  });

  it('rejects names shorter than 3 characters', () => {
    const result = validateChapterName('Ch');
    expect(result.valid).toBe(false);
    expect(result.errors.chapterName).toContain('between 3 and 100');
  });

  it('rejects names longer than 100 characters', () => {
    const result = validateChapterName('A'.repeat(101));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterName).toContain('between 3 and 100');
  });

  it('rejects invalid characters', () => {
    const result = validateChapterName('Chapter #1!');
    expect(result.valid).toBe(false);
    expect(result.errors.chapterName).toContain('letters, digits, spaces, colons, and hyphens');
  });
});

describe('validateSubjectName', () => {
  it('accepts valid subject names', () => {
    expect(validateSubjectName('Mathematics')).toEqual({ valid: true, errors: {} });
    expect(validateSubjectName('A')).toEqual({ valid: true, errors: {} });
  });

  it('rejects empty subject names', () => {
    const result = validateSubjectName('');
    expect(result.valid).toBe(false);
    expect(result.errors.subjectName).toContain('between 1 and 50');
  });

  it('rejects names longer than 50 characters', () => {
    const result = validateSubjectName('A'.repeat(51));
    expect(result.valid).toBe(false);
    expect(result.errors.subjectName).toContain('between 1 and 50');
  });
});

describe('validateSchoolName', () => {
  it('accepts valid school names', () => {
    expect(validateSchoolName('Delhi Public School')).toEqual({ valid: true, errors: {} });
    expect(validateSchoolName('St Marys, Delhi')).toEqual({ valid: true, errors: {} });
  });

  it('rejects names shorter than 5 characters', () => {
    const result = validateSchoolName('ABC');
    expect(result.valid).toBe(false);
    expect(result.errors.schoolName).toContain('between 5 and 30');
  });

  it('rejects names longer than 30 characters', () => {
    const result = validateSchoolName('A'.repeat(31));
    expect(result.valid).toBe(false);
    expect(result.errors.schoolName).toContain('between 5 and 30');
  });

  it('rejects invalid characters', () => {
    const result = validateSchoolName('School @Name');
    expect(result.valid).toBe(false);
    expect(result.errors.schoolName).toContain('letters, digits, commas, spaces, and hyphens');
  });
});
