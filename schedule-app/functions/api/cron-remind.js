/**
 * Cloudflare Pages Function — 自动到期提醒
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 两种触发方式：
 *
 *   ① 手动测试:  GET /api/cron-remind?secret=xxx&debug=1
 *   ② 自动定时:  Cloudflare Cron Trigger 每天 8:00 自动执行
 *      (无需任何外部服务！)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const PUSHPLUS_URL = 'http://www.pushplus.plus/send';
const SUPABASE_URL = 'https://ahvpigapdmizgtyyhvei.supabase.co';

// ──── 工具函数 ─────────────────────────────

async function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function supabaseGet(env, table, query, diag) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (diag) {
    diag.lastUrl = url;
    diag.keyLen = key.length;
    diag.keyPreview = key ? (key.slice(0, 8) + '...' + key.slice(-4)) : '(empty)';
  }

  const resp = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  const text = await resp.text();
  if (diag) { diag.lastStatus = resp.status; diag.lastBodyPreview = text.slice(0, 200); }

  if (!resp.ok) return { error: true, status: resp.status, body: text };
  try { return JSON.parse(text); } catch { return { error: true, parse: true, body: text }; }
}

async function supabasePost(env, table, body) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!resp.ok && resp.status !== 409) console.error(`Supabase POST ${table} failed:`, resp.status, await resp.text());
  return resp.ok ? resp.json() : null;
}

// ──── 核心逻辑（两种触发共用） ──────────────

/**
 * 执行一次提醒扫描
 * @param {object} env - Cloudflare 环境变量（含 SUPABASE_SERVICE_ROLE_KEY）
 * @param {boolean} isDebug - 是否返回详细诊断信息
 * @returns {object} 结果摘要
 */
async function runRemindCheck(env, isDebug = false) {
  const diag = {};
  let sent = 0, skipped = 0, errCount = 0;
  const details = [];

  // Step 1: 获取所有用户设置
  const allSettings = await supabaseGet(env, 'user_settings', 'select=user_id,pushplus_token&limit=1000', diag);
  if (allSettings.error) return { success: false, error: 'Supabase query failed', diag };
  if (!Array.isArray(allSettings)) return { success: false, error: 'unexpected response', type: typeof allSettings };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Step 2: 遍历每个有 token 的用户
  for (const s of allSettings) {
    if (!s.pushplus_token) continue;

    // 查该用户的未完成任务（今天+明天到期）
    const tasksRaw = await supabaseGet(env, 'tasks',
      `select=id,title,end_date,completed,priority&user_id=eq.${s.user_id}&order=end_date.asc&limit=200`,
      diag);
    if (tasksRaw.error || !Array.isArray(tasksRaw)) continue;

    const tomorrowISO = new Date(now.getTime() + 86400000).toISOString();

    const tasks = tasksRaw.filter(t => {
      const c = t.completed;
      if (c === true || c === 1 || c === 'true' || c === '1') return false;
      if (!t.end_date) return false;
      const d = typeof t.end_date === 'string' ? t.end_date : '';
      if (!d) return false;
      const ed = new Date(t.end_date);
      return !isNaN(ed.getTime()) && ed <= new Date(tomorrowISO);
    });

    if (isDebug) { diag.tasksRawCount = (tasksRaw||[]).length; diag.filteredTasksCount = tasks.length; }

    for (const t of tasks) {
      // 检查是否已推送过（去重）
      const logs = await supabaseGet(env, 'reminded_log',
        `task_id=eq.${t.id}&reminded_at=gte.${todayStr}&limit=1`, diag);
      if (Array.isArray(logs) && logs.length > 0) { skipped++; continue; }

      const taskDateStr = String(t.end_date).slice(0, 10);
      const isToday = taskDateStr === todayStr;
      const urgency = isToday ? '⚠️ 今天截止' : `📅 ${taskDateStr} 截止`;
      const priEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority] || '';

      try {
        const r = await fetch(PUSHPLUS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: s.pushplus_token,
            title: `${priEmoji} 任务到期提醒`,
            content: `<b>「${t.title}」</b><br/>${urgency}<br/><br/><i>— IMAUser 智能日程助手</i>`,
            template: 'html',
          }),
        });
        const res = await r.json();
        if (res.code === 200) {
          await supabasePost(env, 'reminded_log', { task_id: t.id, user_id: s.user_id });
          sent++;
          details.push(`✅ ${t.title}`);
        } else {
          errCount++;
          details.push(`❌ ${t.title}: code=${res.code}`);
        }
      } catch (err) {
        errCount++;
        details.push(`❌ ${t.title}: network`);
      }
    }
  }

  const withTokens = allSettings.filter(s => s.pushplus_token).length;
  const result = { success: true, sent, skipped, errors: errCount, users: allSettings.length, withTokens, time: new Date().toISOString(), details: details.slice(0, 20) };
  if (isDebug) result.diag = diag;
  return result;
}


// ──── 触发方式 ①：HTTP 手动调用（调试用） ──────

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

  try {
    const result = await runRemindCheck(env, isDebug);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'internal error', msg: err.message }, 500);
  }
}


// ──── 触发方式 ②：Cloudflare Cron Trigger（自动定时） ──
//    无需外部服务！Cloudflare 自己按 schedule 执行
//    配合 wrangler.toml 中的 [triggers] crons 使用

export async function onScheduled(event, env, ctx) {
  // event.cron = "0 8 * * *" （由 wrangler.toml 定义）
  console.log(`[cron-remind] 定时触发: ${event.cron}`);

  try {
    const result = await runRemindCheck(env, false);
    console.log(`[cron-remind] 完成: sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`);
  } catch (err) {
    console.error('[cron-remind] 失败:', err.message);
  }

  // Scheduled handler 不需要返回 Response（和 onRequest 不同）
}
