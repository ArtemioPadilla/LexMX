import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  // Return mock response during build
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const DELETE: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
