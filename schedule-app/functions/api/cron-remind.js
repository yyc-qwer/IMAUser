/**
 * Cloudflare Pages Function — 自动到期提醒（服务端定时任务）
 * Route: GET /api/cron-remind?secret=xxx
 *
 * 由外部 cron 服务（如 cron-job.org）每小时调用一次。
 * 遍历所有用户的 PushPlus Token，检查到期任务，自动推送到微信。
 * 每天每任务最多提醒一次（通过 reminded_log 去重）。
 */

const PUSHPLUS_URL = 'http://www.pushplus.plus/send';
const SUPABASE_URL = 'https://ahvplgapdmizgtyyhvei.supabase.co';

async function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function supabaseGet(env, table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const resp = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) {
    console.error(`Supabase GET ${table} failed:`, resp.status, await resp.text());
    return [];
  }
  return resp.json();
}

async function supabasePost(env, table, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    // 409 = duplicate (unique constraint), 忽略即可
    if (resp.status !== 409) {
      console.error(`Supabase POST ${table} failed:`, resp.status, await resp.text());
    }
    return null;
  }
  return resp.json();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 安全校验：必须携带正确的 secret
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'missing Supabase env vars' }, 500);
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const details = [];

  try {
    // Step 1: 获取所有已配置 PushPlus token 的用户
    const allSettings = await supabaseGet(
      env,
      'user_settings',
      `select=user_id,pushplus_token&pushplus_token=neq.&limit=1000`
    );

    if (!Array.isArray(allSettings)) {
      return jsonResponse({ error: 'failed to fetch user settings' }, 502);
    }

    // Step 2: 遍历每个用户
    for (const s of allSettings) {
      if (!s.pushplus_token) continue;

      // 获取该用户截止日期在今天/明天的任务 (completed 在 JS 里过滤，避免列类型不匹配)
      const tasksRaw = await supabaseGet(
        env,
        'tasks',
        `select=id,title,end_date,completed&user_id=eq.${s.user_id}&end_date=lte.${tomorrow}&end_date=gte.1900-01-01&order=end_date.asc&limit=50`
      );

      if (!Array.isArray(tasksRaw)) continue;

      // 过滤掉已完成的任务（兼容 boolean / text / int 类型）
      const tasks = tasksRaw.filter(t => {
        const c = t.completed;
        return c !== true && c !== 1 && c !== 'true' && c !== '1';
      });

      for (const t of tasks) {
        if (!t.end_date) continue;

        // 去重：检查今天是否已经提醒过这个任务
        const logs = await supabaseGet(
          env,
          'reminded_log',
          `task_id=eq.${t.id}&reminded_at=gte.${today}&limit=1`
        );

        if (Array.isArray(logs) && logs.length > 0) {
          skipped++;
          continue;
        }

        // 计算紧急程度描述
        const isToday = t.end_date === today;
        const urgency = isToday ? '⚠️ 今天截止' : `📅 明天（${t.end_date}）截止`;
        const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority] || '';

        // 发送 PushPlus 推送
        try {
          const pushResp = await fetch(PUSHPLUS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: s.pushplus_token,
              title: `${priorityEmoji} 任务到期提醒`,
              content: `<b>「${t.title}」</b><br/>${urgency}<br/><br/><i>来自 IMAUser 智能日程助手</i>`,
              template: 'html',
            }),
          });

          const pushResult = await pushResp.json();

          if (pushResult.code === 200) {
            // 记录已提醒（防止重复推送）
            await supabasePost(env, 'reminded_log', {
              task_id: t.id,
              user_id: s.user_id,
            });
            sent++;
            details.push(`✅ ${t.title} → user ${s.user_id.slice(0, 8)}...`);
          } else {
            errors++;
            details.push(`❌ ${t.title}: PushPlus code=${pushResult.code} msg=${pushResult.msg}`);
          }
        } catch (err) {
          errors++;
          details.push(`❌ ${t.title}: network error`);
        }
      }
    }

    return jsonResponse({
      success: true,
      sent,
      skipped,
      errors,
      users: allSettings.length,
      time: new Date().toISOString(),
      details: details.slice(0, 20), // 最多返回 20 条详情
    });
  } catch (err) {
    console.error('cron-remind error:', err.message);
    return jsonResponse({ error: 'internal error', msg: err.message }, 500);
  }
}
