import { validateFileUpload } from './file-validator';

describe('validateFileUpload', () => {
  const MAX_SIZE = 10_485_760; // 10 MB

  describe('valid uploads', () => {
    it('accepts JPEG format within size limit', () => {
      const result = validateFileUpload('jpeg', 5_000_000);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts PNG format within size limit', () => {
      const result = validateFileUpload('png', 1_000_000);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts HEIC format within size limit', () => {
      const result = validateFileUpload('heic', 8_000_000);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts format in uppercase', () => {
      const result = validateFileUpload('JPEG', 5_000_000);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts format in mixed case', () => {
      const result = validateFileUpload('Png', 5_000_000);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts file exactly at 10 MB', () => {
      const result = validateFileUpload('jpeg', MAX_SIZE);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });

  describe('format rejection', () => {
    it('rejects unsupported format (gif)', () => {
      const result = validateFileUpload('gif', 1_000_000);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('format');
      expect(result.errors['format']).toContain('Unsupported format');
    });

    it('rejects unsupported format (bmp)', () => {
      const result = validateFileUpload('bmp', 1_000_000);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('format');
    });

    it('rejects unsupported format (pdf)', () => {
      const result = validateFileUpload('pdf', 1_000_000);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('format');
    });
  });

  describe('size rejection', () => {
    it('rejects file exceeding 10 MB by 1 byte', () => {
      const result = validateFileUpload('jpeg', MAX_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('size');
      expect(result.errors['size']).toContain('File too large');
    });

    it('rejects very large file', () => {
      const result = validateFileUpload('png', 50_000_000);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('size');
    });
  });

  describe('both format and size rejection', () => {
    it('includes both errors when format and size fail', () => {
      const result = validateFileUpload('gif', MAX_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveProperty('format');
      expect(result.errors).toHaveProperty('size');
    });
  });
});
