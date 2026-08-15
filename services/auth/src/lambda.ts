import { createHmac } from 'crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

const JWT_SECRET = process.env.JWT_SECRET || 'learnverse-dev-secret-change-in-production';

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function createJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function placeholder(path: string, method: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Not implemented yet', path, method }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: POST /auth/register/parent
    // TODO: Wire handleRegisterParent once DB/Cognito dependencies are initialized
    if (httpMethod === 'POST' && path === '/auth/register/parent') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /auth/register/learner
    // TODO: Wire handleRegisterLearner once dependencies are initialized
    if (httpMethod === 'POST' && path === '/auth/register/learner') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /auth/login — basic JWT creation (Cognito not wired yet)
    if (httpMethod === 'POST' && path === '/auth/login') {
      const body = JSON.parse(event.body || '{}');
      const { username, password, role } = body;

      if (!username || !password) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'username and password are required' }),
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const token = createJwt({
        sub: username,
        username,
        role: role || 'parent',
        iat: now,
        exp: now + 3600,
      });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ token, expiresIn: 3600 }),
      };
    }

    // Route: POST /auth/forgot-password
    if (httpMethod === 'POST' && path === '/auth/forgot-password') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /auth/verify-otp
    if (httpMethod === 'POST' && path === '/auth/verify-otp') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /auth/reset-password
    if (httpMethod === 'POST' && path === '/auth/reset-password') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /auth/logout
    if (httpMethod === 'POST' && path === '/auth/logout') {
      return placeholder(path, httpMethod);
    }

    // No matching route
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Not found', path, method: httpMethod }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const statusCode = message.includes('Validation') || message.includes('required') ? 400 : 500;
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
}
