/**
 * Unit tests for BcryptPasswordHasher.
 * Uses real bcrypt and verifies the produced hash round-trips.
 */

import * as bcrypt from 'bcrypt';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  it('produces a hash that verifies against the original password', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('Pass1234!');

    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('Pass1234!');
    expect(await bcrypt.compare('Pass1234!', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });

  it('uses cost factor 10 by default', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('Pass1234!');

    // bcrypt hash format: $2b$<cost>$<salt+digest>
    expect(hash.split('$')[2]).toBe('10');
  });

  it('honors a custom cost factor', async () => {
    const hasher = new BcryptPasswordHasher(11);
    const hash = await hasher.hash('Pass1234!');

    expect(hash.split('$')[2]).toBe('11');
    expect(await bcrypt.compare('Pass1234!', hash)).toBe(true);
  });
});
