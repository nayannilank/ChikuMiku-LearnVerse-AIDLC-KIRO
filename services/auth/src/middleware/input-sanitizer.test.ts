/**
 * Unit tests for input sanitization utility.
 * Validates: Requirements 20.1, 20.3
 */

import {
  escapeHtml,
  stripHtmlTags,
  containsDangerousPatterns,
  sanitizeInput,
  sanitizeObject,
} from './input-sanitizer';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it('escapes backticks', () => {
    expect(escapeHtml('`code`')).toBe('&#96;code&#96;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not modify safe strings', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('stripHtmlTags', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtmlTags('<b>bold</b>')).toBe('bold');
  });

  it('removes script tags and content', () => {
    expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('removes self-closing tags', () => {
    expect(stripHtmlTags('line1<br/>line2')).toBe('line1line2');
  });

  it('handles nested tags', () => {
    expect(stripHtmlTags('<div><p>text</p></div>')).toBe('text');
  });

  it('does not modify plain text', () => {
    expect(stripHtmlTags('no tags here')).toBe('no tags here');
  });
});

describe('containsDangerousPatterns', () => {
  it('detects script tags', () => {
    expect(containsDangerousPatterns('<script>alert(1)</script>')).toBe(true);
  });

  it('detects javascript: protocol', () => {
    expect(containsDangerousPatterns('javascript:void(0)')).toBe(true);
  });

  it('detects event handlers (onclick)', () => {
    expect(containsDangerousPatterns('onclick=alert(1)')).toBe(true);
  });

  it('detects onerror handler', () => {
    expect(containsDangerousPatterns('onerror = malicious()')).toBe(true);
  });

  it('detects data:text/html', () => {
    expect(containsDangerousPatterns('data: text/html,<h1>X</h1>')).toBe(true);
  });

  it('detects vbscript', () => {
    expect(containsDangerousPatterns('vbscript:evil')).toBe(true);
  });

  it('returns false for safe strings', () => {
    expect(containsDangerousPatterns('Hello World')).toBe(false);
    expect(containsDangerousPatterns('Mathematics Grade 5')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(containsDangerousPatterns('')).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('removes null bytes', () => {
    expect(sanitizeInput('hel\0lo')).toBe('hello');
  });

  it('escapes HTML in the result', () => {
    expect(sanitizeInput('<script>xss</script>')).toBe(
      '&lt;script&gt;xss&lt;&#x2F;script&gt;'
    );
  });

  it('handles combined issues', () => {
    expect(sanitizeInput('  \0<b>test</b>\0  ')).toBe('&lt;b&gt;test&lt;&#x2F;b&gt;');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeInput('   ')).toBe('');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes all string values', () => {
    const obj = { name: '<b>Test</b>', age: 10 };
    const result = sanitizeObject(obj);

    expect(result.name).toBe('&lt;b&gt;Test&lt;&#x2F;b&gt;');
    expect(result.age).toBe(10);
  });

  it('does not modify non-string values', () => {
    const obj = { count: 5, active: true, tags: ['a', 'b'] };
    const result = sanitizeObject(obj);

    expect(result.count).toBe(5);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('returns a new object (does not mutate input)', () => {
    const obj = { name: '<script>x</script>' };
    const result = sanitizeObject(obj);

    expect(result).not.toBe(obj);
    expect(obj.name).toBe('<script>x</script>');
  });
});
