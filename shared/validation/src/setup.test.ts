import * as fc from 'fast-check';

describe('Monorepo setup verification', () => {
  it('should run Jest tests successfully', () => {
    expect(1 + 1).toBe(2);
  });

  it('should run fast-check property tests successfully', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      })
    );
  });
});
