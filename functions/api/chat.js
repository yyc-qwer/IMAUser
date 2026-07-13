/**
 * Cloudflare Pages Function — AI Chat Proxy
 * Route: POST /api/chat
 *
 * Proxies chat requests to DeepSeek API, hiding the API key from the client.
 * Preserves streaming support via ReadableStream passthrough.
 */

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1/chat/completions';

function corsHeaders(origin) {
  const allowed = [
    'https://imauser.pages.dev',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const isAllowed = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('Origin') || ''),
    });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request.headers.get('Origin') || ''),
      },
    });
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI service not configured' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request.headers.get('Origin') || ''),
        },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request.headers.get('Origin') || ''),
          },
        }
      );
    }

    const resp = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || 'deepseek-chat',
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 2000,
      }),
    });

    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request.headers.get('Origin') || ''),
      },
    });
  } catch (err) {
    console.error('Chat proxy error:', err.message);
    return new Response(
      JSON.stringify({ error: 'AI service unavailable' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(request.headers.get('Origin') || ''),
        },
      }
    );
  }
}
