/**
 * Cloudflare Pages Function — PushPlus 微信提醒代理
 * Route: POST /api/remind
 *
 * 代理 PushPlus API 调用，避免在客户端暴露推送逻辑。
 * PushPlus 文档: https://www.pushplus.plus/doc/
 */

const PUSHPLUS_URL = 'http://www.pushplus.plus/send';

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
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('Origin') || ''),
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request.headers.get('Origin') || ''),
      },
    });
  }

  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.token || !body.title) {
      return new Response(
        JSON.stringify({ error: 'token and title are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(request.headers.get('Origin') || ''),
          },
        }
      );
    }

    // 调用 PushPlus API
    const resp = await fetch(PUSHPLUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: body.token,
        title: body.title,
        content: body.content || body.title,
        template: body.template || 'html',
        channel: body.channel || 'wechat',
      }),
    });

    const data = await resp.json();

    // PushPlus 返回 code 200 表示成功
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request.headers.get('Origin') || ''),
      },
    });
  } catch (err) {
    console.error('PushPlus proxy error:', err.message);
    return new Response(
      JSON.stringify({ error: 'Push service unavailable', msg: err.message }),
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
