/**
 * Cloudflare Pages Function — 自动到期提醒（服务端定时任务）
 * Route: GET /api/cron-remind?secret=xxx
 * 调试模式: GET /api/cron-remind?secret=xxx&debug=1
 */

const PUSHPLUS_URL = 'http://www.pushplus.plus/send';
const SUPABASE_URL = 'https://ahvpigapdmizgtyyhvei.supabase.co';

async function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function supabaseGet(env, table, query, diag) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  diag.lastUrl = url;
  diag.keyLen = key.length;
  diag.keyPreview = key ? (key.slice(0, 8) + '...' + key.slice(-4)) : '(empty)';
  
  const resp = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  
  const text = await resp.text();
  diag.lastStatus = resp.status;
  diag.lastBodyPreview = text.slice(0, 200);
  
  if (!resp.ok) {
    return { error: true, status: resp.status, body: text };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { error: true, parse: true, body: text };
  }
}

async function supabasePost(env, table, body) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
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
  const isDebug = url.searchParams.get('debug') === '1';

  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'missing SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const diag = {};
  let sent = 0, skipped = 0, errCount = 0;
  const details = [];

  try {
    // Step 1: 获取所有 user_settings
    const allSettings = await supabaseGet(env, 'user_settings', 'select=user_id,pushplus_token&limit=1000', diag);

    if (allSettings.error) {
      return jsonResponse({
        success: false,
        error: 'Supabase query failed',
        diag,
      }, 502);
    }

    if (!Array.isArray(allSettings)) {
      return jsonResponse({
        success: false,
        error: 'unexpected response type',
        type: typeof allSettings,
        diag,
      }, 502);
    }

    // Step 2: 遍历每个有 token 的用户
    for (const s of allSettings) {
      if (!s.pushplus_token) continue;

      // 查询该用户所有未完成任务（不过滤日期，避免 timestamptz 时区问题）
      const tasksRaw = await supabaseGet(env, 'tasks',
        `select=id,title,end_date,completed,priority&user_id=eq.${s.user_id}&order=end_date.asc&limit=200`,
        diag
      );

      if (tasksRaw.error || !Array.isArray(tasksRaw)) continue;

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC
      // 明天同时间的 ISO 字符串，用于比较
      const tomorrowISO = new Date(now.getTime() + 86400000).toISOString();

      const tasks = tasksRaw.filter(t => {
        // 排除已完成的
        const c = t.completed;
        if (c === true || c === 1 || c === 'true' || c === '1') return false;
        if (!t.end_date) return false;

        // 提取 end_date 的日期部分（兼容纯日期字符串和完整时间戳）
        const d = typeof t.end_date === 'string' ? t.end_date.slice(0, 10) : '';
        if (!d) return false;

        // 只处理今天或明天到期的任务
        const endDateObj = new Date(t.end_date);
        return !isNaN(endDateObj.getTime()) && endDateObj <= new Date(tomorrowISO);
      });

      diag.tasksRawCount = (tasksRaw || []).length;
      diag.filteredTasksCount = tasks.length;

      for (const t of tasks) {
        if (!t.end_date) continue;

        const logs = await supabaseGet(env, 'reminded_log',
          `task_id=eq.${t.id}&reminded_at=gte.${todayStr}&limit=1`, diag);

        if (Array.isArray(logs) && logs.length > 0) { skipped++; continue; }

        // 正确提取日期进行比较（兼容 timestamptz 和纯日期）
        const taskDateStr = String(t.end_date).slice(0, 10);
        const isToday = taskDateStr === todayStr;
        const urgency = isToday ? '⚠️ 今天截止' : `📅 ${taskDateStr} 截止`;
        const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority] || '';

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
            await supabasePost(env, 'reminded_log', { task_id: t.id, user_id: s.user_id });
            sent++;
            details.push(`✅ ${t.title}`);
          } else {
            errCount++;
            details.push(`❌ ${t.title}: code=${pushResult.code}`);
          }
        } catch (err) {
          errCount++;
          details.push(`❌ ${t.title}: network`);
        }
      }
    }

    const withTokens = allSettings.filter(s => s.pushplus_token).length;

    const result = {
      success: true,
      sent, skipped, errors: errCount,
      users: allSettings.length,
      withTokens,
      time: new Date().toISOString(),
      details: details.slice(0, 20),
    };

    if (isDebug) {
      result.diag = diag;
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'internal error', msg: err.message, diag }, 500);
  }
}
