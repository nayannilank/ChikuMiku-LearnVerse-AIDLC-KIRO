/**
 * Integration tests for API Gateway → Lambda routing.
 * Verifies that routes are mapped to the correct Lambda handlers and that
 * authorization requirements are enforced correctly.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import { validateToken, createToken, DecodedToken } from '../../auth/src/middleware/jwt-validator';

// --- Route Configuration (mirrors infra/src/stacks/learnverse-stack.ts) ---

interface RouteConfig {
  path: string;
  methods: string[];
  handler: string;
  requiresAuth: boolean;
}

/**
 * Route table as defined in the CDK stack.
 * Auth routes do NOT require Cognito authorization.
 * All other routes require a valid JWT.
 */
const ROUTE_TABLE: RouteConfig[] = [
  { path: '/auth', methods: ['ANY'], handler: 'learnverse-auth', requiresAuth: false },
  { path: '/auth/{proxy+}', methods: ['ANY'], handler: 'learnverse-auth', requiresAuth: false },
  { path: '/content', methods: ['ANY'], handler: 'learnverse-content', requiresAuth: true },
  { path: '/content/{proxy+}', methods: ['ANY'], handler: 'learnverse-content', requiresAuth: true },
  { path: '/learn', methods: ['ANY'], handler: 'learnverse-learning', requiresAuth: true },
  { path: '/learn/{proxy+}', methods: ['ANY'], handler: 'learnverse-learning', requiresAuth: true },
  { path: '/ai', methods: ['ANY'], handler: 'learnverse-ai-gateway', requiresAuth: true },
  { path: '/ai/{proxy+}', methods: ['ANY'], handler: 'learnverse-ai-gateway', requiresAuth: true },
  { path: '/export', methods: ['ANY'], handler: 'learnverse-export', requiresAuth: true },
  { path: '/export/{proxy+}', methods: ['ANY'], handler: 'learnverse-export', requiresAuth: true },
];

// --- Mock Lambda Invocation ---

interface LambdaInvocation {
  functionName: string;
  event: {
    path: string;
    httpMethod: string;
    headers: Record<string, string>;
    body?: string;
  };
}

/**
 * Simulates API Gateway routing a request to the correct Lambda.
 * Resolves the route path to a handler name and checks auth requirements.
 */
function routeRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  jwtSecret: string
): { invocation: LambdaInvocation | null; statusCode: number; error?: string } {
  // Find matching route
  const route = resolveRoute(path);

  if (!route) {
    return { invocation: null, statusCode: 404, error: 'Route not found' };
  }

  // Check authorization if required
  if (route.requiresAuth) {
    const authHeader = headers['Authorization'] || headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { invocation: null, statusCode: 401, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.substring(7);
    const validationResult = validateToken(token, jwtSecret, new Date());

    if (!validationResult.valid) {
      return { invocation: null, statusCode: 401, error: validationResult.error };
    }
  }

  // Route to the correct Lambda
  return {
    invocation: {
      functionName: route.handler,
      event: { path, httpMethod: method, headers },
    },
    statusCode: 200,
  };
}

/**
 * Resolves a request path to the matching route config.
 */
function resolveRoute(path: string): RouteConfig | null {
  // Normalize path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Check exact matches first, then proxy patterns
  for (const route of ROUTE_TABLE) {
    if (route.path === normalizedPath) return route;
  }

  // Check proxy routes (e.g., /auth/{proxy+} matches /auth/login)
  for (const route of ROUTE_TABLE) {
    if (route.path.endsWith('{proxy+}')) {
      const prefix = route.path.replace('/{proxy+}', '');
      if (normalizedPath.startsWith(prefix + '/') && normalizedPath.length > prefix.length + 1) {
        return route;
      }
    }
  }

  return null;
}

// --- Tests ---

describe('API Gateway → Lambda Integration Tests', () => {
  const JWT_SECRET = 'integration-test-secret-key-for-testing';

  function createValidToken(overrides?: Partial<DecodedToken>): string {
    const payload: DecodedToken = {
      userId: 'user-001',
      username: 'testparent',
      role: 'parent',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      ...overrides,
    };
    return createToken(payload, JWT_SECRET);
  }

  describe('Route resolution', () => {
    it('routes /auth/* to the Auth Lambda without authorization', () => {
      const result = routeRequest('/auth/login', 'POST', {}, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation).not.toBeNull();
      expect(result.invocation!.functionName).toBe('learnverse-auth');
    });

    it('routes /auth/register to the Auth Lambda without authorization', () => {
      const result = routeRequest('/auth/register', 'POST', {}, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-auth');
    });

    it('routes /auth/forgot-password to the Auth Lambda without authorization', () => {
      const result = routeRequest('/auth/forgot-password', 'POST', {}, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-auth');
    });

    it('routes /content/* to the Content Lambda with valid JWT', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };
      const result = routeRequest('/content/chapters', 'GET', headers, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-content');
    });

    it('routes /learn/* to the Learning Lambda with valid JWT', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };
      const result = routeRequest('/learn/dashboard', 'GET', headers, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-learning');
    });

    it('routes /ai/* to the AI Gateway Lambda with valid JWT', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };
      const result = routeRequest('/ai/explain', 'POST', headers, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-ai-gateway');
    });

    it('routes /export/* to the Export Lambda with valid JWT', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };
      const result = routeRequest('/export/pdf', 'POST', headers, JWT_SECRET);

      expect(result.statusCode).toBe(200);
      expect(result.invocation!.functionName).toBe('learnverse-export');
    });

    it('returns 404 for unknown routes', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };
      const result = routeRequest('/unknown/path', 'GET', headers, JWT_SECRET);

      expect(result.statusCode).toBe(404);
      expect(result.invocation).toBeNull();
    });
  });

  describe('Authorization enforcement', () => {
    it('rejects /content/* requests without Authorization header', () => {
      const result = routeRequest('/content/chapters', 'GET', {}, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Authorization');
      expect(result.invocation).toBeNull();
    });

    it('rejects /learn/* requests without Authorization header', () => {
      const result = routeRequest('/learn/streak', 'GET', {}, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.invocation).toBeNull();
    });

    it('rejects /ai/* requests without Authorization header', () => {
      const result = routeRequest('/ai/pronunciation', 'POST', {}, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.invocation).toBeNull();
    });

    it('rejects /export/* requests without Authorization header', () => {
      const result = routeRequest('/export/csv', 'GET', {}, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.invocation).toBeNull();
    });

    it('rejects requests with expired JWT', () => {
      const expiredToken = createToken(
        {
          userId: 'user-001',
          username: 'testparent',
          role: 'parent',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        JWT_SECRET
      );
      const headers = { Authorization: `Bearer ${expiredToken}` };
      const result = routeRequest('/content/chapters', 'GET', headers, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Token expired');
    });

    it('rejects requests with invalid JWT signature', () => {
      const wrongSecretToken = createToken(
        {
          userId: 'user-001',
          username: 'testparent',
          role: 'parent',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        'wrong-secret-key'
      );
      const headers = { Authorization: `Bearer ${wrongSecretToken}` };
      const result = routeRequest('/content/chapters', 'GET', headers, JWT_SECRET);

      expect(result.statusCode).toBe(401);
      expect(result.error).toBe('Invalid signature');
    });

    it('allows /auth/* routes regardless of token presence', () => {
      // No token
      const noToken = routeRequest('/auth/login', 'POST', {}, JWT_SECRET);
      expect(noToken.statusCode).toBe(200);

      // Invalid token (still allowed because auth routes don't check)
      const headers = { Authorization: 'Bearer totally-invalid-token' };
      const withInvalidToken = routeRequest('/auth/register', 'POST', headers, JWT_SECRET);
      expect(withInvalidToken.statusCode).toBe(200);
    });
  });

  describe('Correct Lambda invocation', () => {
    it('passes the full path and method to the invoked Lambda', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const result = routeRequest('/content/chapters/ch-123/pages', 'POST', headers, JWT_SECRET);

      expect(result.invocation!.event.path).toBe('/content/chapters/ch-123/pages');
      expect(result.invocation!.event.httpMethod).toBe('POST');
      expect(result.invocation!.event.headers['Content-Type']).toBe('application/json');
    });

    it('maps nested content paths to the Content Lambda', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };

      const paths = [
        '/content/chapters/ch-1/pages',
        '/content/chapters/ch-1/ocr',
        '/content/chapters/ch-1/transcript',
      ];

      for (const path of paths) {
        const result = routeRequest(path, 'GET', headers, JWT_SECRET);
        expect(result.invocation!.functionName).toBe('learnverse-content');
      }
    });

    it('maps nested learning paths to the Learning Lambda', () => {
      const token = createValidToken();
      const headers = { Authorization: `Bearer ${token}` };

      const paths = [
        '/learn/dashboard',
        '/learn/streak',
        '/learn/progress/ch-1',
      ];

      for (const path of paths) {
        const result = routeRequest(path, 'GET', headers, JWT_SECRET);
        expect(result.invocation!.functionName).toBe('learnverse-learning');
      }
    });
  });
});
