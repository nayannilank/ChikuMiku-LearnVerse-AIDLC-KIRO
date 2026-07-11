/**
 * Property-based tests for JWT token validation.
 * Feature: chikumiku-learnverse, Property 16: JWT Token Validation
 *
 * **Validates: Requirements 20.7**
 *
 * Generate tokens with random expiration timestamps and signatures,
 * verify rejection when expired or invalid signature.
 */
import * as fc from 'fast-check';
import { validateToken, createToken, DecodedToken } from './jwt-validator';

// --- Arbitraries ---

/** Generate a random role for the token payload. */
const roleArb = fc.constantFrom<'parent' | 'learner'>('parent', 'learner');

/** Generate a non-empty secret string (at least 8 chars for realistic usage). */
const secretArb = fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.length >= 8);

/**
 * Generate a valid DecodedToken payload with a configurable expiration generator.
 */
function decodedTokenArb(expArb: fc.Arbitrary<number>): fc.Arbitrary<DecodedToken> {
  return fc.record({
    userId: fc.uuid(),
    username: fc.stringMatching(/^[a-z0-9_-]{8,15}$/),
    role: roleArb,
    exp: expArb,
  });
}

/**
 * Generate a "now" timestamp and a future expiration (token not expired).
 * nowSeconds is a realistic epoch seconds value; exp is 60-3600 seconds in the future.
 */
const futureExpArb = fc
  .tuple(
    fc.integer({ min: 1_700_000_000, max: 1_900_000_000 }), // nowSeconds
    fc.integer({ min: 60, max: 3600 }), // seconds into the future
  )
  .map(([nowSeconds, offset]) => ({
    nowSeconds,
    exp: nowSeconds + offset,
  }));

/**
 * Generate a "now" timestamp and a past expiration (token expired).
 * exp is 1-7200 seconds in the past relative to now.
 */
const pastExpArb = fc
  .tuple(
    fc.integer({ min: 1_700_000_000, max: 1_900_000_000 }), // nowSeconds
    fc.integer({ min: 1, max: 7200 }), // seconds into the past
  )
  .map(([nowSeconds, offset]) => ({
    nowSeconds,
    exp: nowSeconds - offset,
  }));

/**
 * Generate a different secret that is guaranteed to differ from the original.
 */
function differentSecretArb(original: string): fc.Arbitrary<string> {
  return secretArb.filter((s) => s !== original);
}

/** Generate random non-JWT strings for malformed token testing. */
const malformedTokenArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 100 }).filter((s) => s.split('.').length !== 3),
  fc.string({ minLength: 1, maxLength: 50 }).map((s) => `${s}.${s}`), // only 2 parts
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 20 }), // single segment
);

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 16: JWT Token Validation', () => {
  it('valid tokens (future exp, correct signature) return { valid: true } with correct payload', () => {
    fc.assert(
      fc.property(
        futureExpArb,
        secretArb,
        fc.uuid(),
        fc.stringMatching(/^[a-z0-9_-]{8,15}$/),
        roleArb,
        ({ nowSeconds, exp }, secret, userId, username, role) => {
          const payload: DecodedToken = { userId, username, role, exp };
          const token = createToken(payload, secret);
          const now = new Date(nowSeconds * 1000);

          const result = validateToken(token, secret, now);

          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.payload.userId).toBe(userId);
            expect(result.payload.username).toBe(username);
            expect(result.payload.role).toBe(role);
            expect(result.payload.exp).toBe(exp);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('expired tokens (past exp, correct signature) return { valid: false, error: "Token expired" }', () => {
    fc.assert(
      fc.property(
        pastExpArb,
        secretArb,
        fc.uuid(),
        fc.stringMatching(/^[a-z0-9_-]{8,15}$/),
        roleArb,
        ({ nowSeconds, exp }, secret, userId, username, role) => {
          const payload: DecodedToken = { userId, username, role, exp };
          const token = createToken(payload, secret);
          const now = new Date(nowSeconds * 1000);

          const result = validateToken(token, secret, now);

          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe('Token expired');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('invalid signature (future exp, wrong secret) return { valid: false, error: "Invalid signature" }', () => {
    fc.assert(
      fc.property(
        futureExpArb,
        secretArb,
        fc.uuid(),
        fc.stringMatching(/^[a-z0-9_-]{8,15}$/),
        roleArb,
        ({ nowSeconds, exp }, signingSecret, userId, username, role) => {
          const payload: DecodedToken = { userId, username, role, exp };
          const token = createToken(payload, signingSecret);
          const now = new Date(nowSeconds * 1000);

          // Validate with a completely different secret
          const wrongSecret = signingSecret + '_tampered';
          const result = validateToken(token, wrongSecret, now);

          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe('Invalid signature');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('malformed tokens (random strings) return { valid: false, error: "Malformed token" }', () => {
    fc.assert(
      fc.property(malformedTokenArb, secretArb, (token, secret) => {
        const now = new Date();
        const result = validateToken(token, secret, now);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toBe('Malformed token');
        }
      }),
      { numRuns: 100 },
    );
  });
});
