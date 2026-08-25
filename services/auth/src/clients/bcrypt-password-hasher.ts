/**
 * Bcrypt-backed PasswordHasher for the auth service.
 *
 * Concrete implementation of the `PasswordHasher` port used by the learner
 * registration handler. Hashes plaintext passwords with bcrypt at cost
 * factor 10, matching the parent-registration flow (Req 20.2).
 */

import * as bcrypt from 'bcrypt';
import type { PasswordHasher } from '../handlers/register-learner';

/** Minimum bcrypt cost factor per security requirements. */
const BCRYPT_COST_FACTOR = 10;

/** Password hasher backed by bcrypt. */
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly costFactor: number;

  /**
   * @param costFactor bcrypt cost factor (defaults to 10; must be >= 10).
   */
  constructor(costFactor: number = BCRYPT_COST_FACTOR) {
    this.costFactor = costFactor;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.costFactor);
  }
}
