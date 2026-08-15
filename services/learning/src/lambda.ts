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
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      learners: [
        {
          id: 'learner-1',
          name: 'Chiku',
          grade: '3rd',
          streak: 5,
          lastActivity: new Date().toISOString(),
          progressPercent: 42,
        },
      ],
      notifications: [],
      weeklyGoal: { target: 5, completed: 3 },
    }),
  };
}

function mockLearnerDashboard(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      streak: 5,
      todayCompleted: false,
      chaptersInProgress: [
        { id: 'ch-1', title: 'Solar System', progressPercent: 60 },
      ],
      badges: ['first-chapter', 'streak-3'],
      nextActivity: { type: 'revision', chapterId: 'ch-1' },
    }),
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
