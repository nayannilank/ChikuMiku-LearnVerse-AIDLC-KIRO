import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

function placeholder(path: string, method: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: 'Not implemented yet', path, method }),
  };
}

function mockParentDashboard(): APIGatewayProxyResult {
  // No database wired yet — return an empty dashboard so newly registered
  // parents see the empty state + "Add Learner" button (per the mock).
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ learners: [] }),
  };
}

function mockLearnerDashboard(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ learnerName: '', streak: 0, subjects: [] }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: GET /learn/dashboard/parent
    if (httpMethod === 'GET' && path === '/learn/dashboard/parent') {
      return mockParentDashboard();
    }

    // Route: GET /learn/dashboard/learner
    if (httpMethod === 'GET' && path === '/learn/dashboard/learner') {
      return mockLearnerDashboard();
    }

    // Route: POST /learn/activity
    if (httpMethod === 'POST' && path === '/learn/activity') {
      return placeholder(path, httpMethod);
    }

    // Route: GET /learn/streak/:id
    if (httpMethod === 'GET' && /^\/learn\/streak\/[^/]+$/.test(path)) {
      return placeholder(path, httpMethod);
    }

    // Route: GET /learn/progress/:id
    if (httpMethod === 'GET' && /^\/learn\/progress\/[^/]+$/.test(path)) {
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
