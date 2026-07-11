/**
 * Environment configuration for the mobile client.
 *
 * Provides API_BASE_URL and environment detection based on build configuration.
 * In production builds, the API URL points to the deployed API Gateway endpoint.
 * In development, it points to localhost or a dev environment.
 *
 * Validates: Requirements 19.1, 19.2
 */

export type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  apiBaseUrl: string;
  environment: Environment;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
}

/**
 * Configuration per environment.
 * In a real React Native app, these would be injected via react-native-config
 * or built-in environment variables at build time.
 */
const configs: Record<Environment, EnvironmentConfig> = {
  development: {
    apiBaseUrl: 'http://10.0.2.2:3000/v1',
    environment: 'development',
    requestTimeoutMs: 30000,
  },
  staging: {
    apiBaseUrl: 'https://api-staging.chikumiku-learnverse.com/v1',
    environment: 'staging',
    requestTimeoutMs: 15000,
  },
  production: {
    apiBaseUrl: 'https://api.chikumiku-learnverse.com/v1',
    environment: 'production',
    requestTimeoutMs: 10000,
  },
};

/**
 * Detect the current environment.
 * Uses __DEV__ global provided by React Native bundler.
 */
function detectEnvironment(): Environment {
  // React Native provides __DEV__ at build time
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
  }
  return 'production';
}

// Declare the React Native __DEV__ global
declare const __DEV__: boolean | undefined;

/** Current environment configuration */
export const environment: EnvironmentConfig = configs[detectEnvironment()];

/** Convenience export for the API base URL */
export const API_BASE_URL: string = environment.apiBaseUrl;
