import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/shared',
    '<rootDir>/services',
    '<rootDir>/infra',
    '<rootDir>/clients',
  ],
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  moduleNameMapper: {
    '@chikumiku/types': '<rootDir>/shared/types/src',
    '@chikumiku/validation': '<rootDir>/shared/validation/src',
  },
  collectCoverageFrom: [
    '**/src/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  passWithNoTests: true,
};

export default config;
