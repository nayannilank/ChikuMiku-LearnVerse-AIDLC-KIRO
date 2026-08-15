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

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: POST /ai/ocr
    if (httpMethod === 'POST' && path === '/ai/ocr') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /ai/explain
    if (httpMethod === 'POST' && path === '/ai/explain') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /ai/pronunciation/score
    if (httpMethod === 'POST' && path === '/ai/pronunciation/score') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /ai/grammar
    if (httpMethod === 'POST' && path === '/ai/grammar') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /ai/qa
    if (httpMethod === 'POST' && path === '/ai/qa') {
      return placeholder(path, httpMethod);
    }

    // Route: POST /ai/revision
    if (httpMethod === 'POST' && path === '/ai/revision') {
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
