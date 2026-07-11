/**
 * CORS configuration utility tied to the security config.
 *
 * Provides strict CORS headers for API Gateway Lambda responses.
 * Only allows requests from known origins (the web client domain)
 * and restricts methods, headers, and credentials appropriately.
 *
 * Requirements: 20.1, 20.3
 */

export interface CorsConfig {
  /** Allowed origins (exact match). */
  allowedOrigins: string[];
  /** Allowed HTTP methods. */
  allowedMethods: string[];
  /** Allowed request headers. */
  allowedHeaders: string[];
  /** Headers exposed to the browser. */
  exposedHeaders: string[];
  /** Whether to allow credentials (cookies, auth headers). */
  allowCredentials: boolean;
  /** Preflight cache duration in seconds. */
  maxAge: number;
}

/**
 * Default CORS configuration for the LearnVerse API.
 * Origins should be updated to match deployment environment.
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [
    'https://learnverse.chikumiku.com',
    'https://app.chikumiku.com',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Development CORS configuration — allows localhost origins.
 * Only use in development/staging environments.
 */
export const DEV_CORS_CONFIG: CorsConfig = {
  ...DEFAULT_CORS_CONFIG,
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://learnverse.chikumiku.com',
    'https://app.chikumiku.com',
  ],
};

/**
 * Checks if a given origin is allowed by the CORS configuration.
 *
 * @param origin - The request Origin header value
 * @param config - CORS configuration to check against
 * @returns true if the origin is allowed
 */
export function isOriginAllowed(origin: string | undefined | null, config: CorsConfig): boolean {
  if (!origin) return false;
  return config.allowedOrigins.includes(origin);
}

/**
 * Builds CORS response headers for a given request origin.
 * Returns an empty object if the origin is not allowed (no CORS headers = browser blocks it).
 *
 * @param origin - The request Origin header value
 * @param config - CORS configuration
 * @returns CORS headers to include in the response
 */
export function buildCorsHeaders(
  origin: string | undefined | null,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): Record<string, string> {
  if (!isOriginAllowed(origin, config)) {
    return {};
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Methods': config.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
    'Access-Control-Expose-Headers': config.exposedHeaders.join(', '),
    'Access-Control-Max-Age': String(config.maxAge),
  };

  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Builds a preflight (OPTIONS) response with CORS headers.
 * Returns a complete Lambda response object for OPTIONS requests.
 *
 * @param origin - The request Origin header value
 * @param config - CORS configuration
 */
export function buildPreflightResponse(
  origin: string | undefined | null,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): { statusCode: number; headers: Record<string, string>; body: string } {
  const corsHeaders = buildCorsHeaders(origin, config);

  if (Object.keys(corsHeaders).length === 0) {
    return { statusCode: 403, headers: {}, body: '' };
  }

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: '',
  };
}
