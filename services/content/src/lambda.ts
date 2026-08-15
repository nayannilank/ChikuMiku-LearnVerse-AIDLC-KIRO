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
    // Route: POST /content/chapters
    if (httpMethod === 'POST' && path === '/content/chapters') {
      return placeholder(path, httpMethod);
    }

    // Route: GET /content/chapters/:id
    if (httpMethod === 'GET' && /^\/content\/chapters\/[^/]+$/.test(path)) {
      return placeholder(path, httpMethod);
    }

    // Route: POST /content/chapters/:id/pages
    if (httpMethod === 'POST' && /^\/content\/chapters\/[^/]+\/pages$/.test(path)) {
      return placeholder(path, httpMethod);
    }

    // Route: GET /content/chapters/:id/ocr-status
    if (httpMethod === 'GET' && /^\/content\/chapters\/[^/]+\/ocr-status$/.test(path)) {
      return placeholder(path, httpMethod);
    }

    // Route: PUT /content/chapters/:id/transcript
    if (httpMethod === 'PUT' && /^\/content\/chapters\/[^/]+\/transcript$/.test(path)) {
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
