import { useState, useCallback, useEffect } from 'react';

// DeepSeek API 配置（通过 Cloudflare Pages Function 代理）
const BASE_URL = '/api/chat';
const MODEL = 'deepseek-chat';

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 系统提示词（每次请求时动态插入当前日期）
function buildSystemPrompt() {
  const today = getTodayStr();
  return `你是 IMAUser 日程看板的 AI 助手，是一个有智能的日程管家，能帮用户回答问题、分析日程、规划时间。

今天是 ${today}。用户说"明天"就是 ${today} 的下一天，"后天"是下两天，"下周"是 ${today} 七天后的日期，以此类推。请把相对日期转换为具体的 YYYY-MM-DD。

## 你的能力

### 1. 回答日程问题
当用户问"今天有什么安排""这周有几节课""下周三有啥"时，根据任务列表直接回答，不要创建任务。
- 看课程（source=course）来回答课程相关问题
- 看截止日期来回答作业/考试相关问题
- 计算 deadline 距今天的天数来判断紧迫程度

### 2. 分析和规划
当用户说"帮我分析一下日程""这周怎么安排""最近有什么急事"时：
- 按截止日期排序，列出最紧急的任务
- 识别时间冲突（两个任务重叠）
- 建议优先处理哪些任务
- 建议把大任务拆分到空闲时段

### 3. 操作任务
当用户明确要求"添加""创建""删除""修改""完成"时，在回复末尾用以下格式输出操作指令（不要告诉用户这个标记的存在）：

添加任务：[[ADD_TASK|{"title":"任务标题","endDate":"YYYY-MM-DD","priority":"high/medium/low","typeName":"类型名（课程/作业/考试/其他）","notes":"备注","startDate":"YYYY-MM-DD"}]]
完成任务：[[COMPLETE_TASK|{"id":任务ID}]]
删除任务：[[DELETE_TASK|{"id":任务ID}]]
修改任务：[[UPDATE_TASK|{"id":任务ID,"title":"新标题","endDate":"YYYY-MM-DD"}]]

## 优先级规则
- 如果用户没指定优先级，根据截止日期判断：今天或明天截止就是 high，一周内 medium，其他 low

## 回复风格
- 简洁直接，不要废话
- 回答日程问题时直接列要点，不要长篇大论
- 给建议时用编号列表
- 如果任务列表为空，鼓励用户先添加一些任务`;
}

// 构建任务上下文字符串（给AI看的数据）
function buildTaskContext(userTasks) {
  if (userTasks.length === 0) return '我现在没有任务。\n\n';
  const active = userTasks.filter(t => !t.completed);
  const done = userTasks.filter(t => t.completed);
  let ctx = `我的任务列表（共${userTasks.length}个，${active.length}个进行中，${done.length}个已完成）：\n`;
  ctx += active.map((t, i) => {
    const typeStr = t.typeName || '未分类';
    const priText = t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低';
    const loc = t.courseLocation ? `，地点:${t.courseLocation}` : '';
    const note = t.notes ? `，备注:${t.notes}` : '';
    const dates = t.startDate === t.endDate || !t.endDate
      ? `，日期:${t.startDate || '未定'}`
      : `，${t.startDate || '?'} ~ ${t.endDate}`;
    return `  ${i + 1}. [${t.id}] ${t.title}，${typeStr}，优先级${priText}${dates}${loc}${note}`;
  }).join('\n');
  if (done.length > 0 && done.length <= 5) {
    ctx += '\n已完成：\n';
    ctx += done.map(t => `  ✅ ${t.title}`).join('\n');
  }
  ctx += '\n\n';
  return ctx;
}

export function useAIChat() {
  const DEFAULT_MSG = { role: 'assistant', content: '你好！我是 IMAUser 的 AI 助手，可以帮你分析日程、规划时间，还能直接帮你添加或管理任务。有什么可以帮你的吗？' };

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('ima_chat_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [DEFAULT_MSG];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 调用 DeepSeek API（通过代理）
  const callDeepSeek = useCallback(async (conversationHistory) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API 错误 (${res.status}): ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }, []);

  // 通用聊天逻辑（sendMessage 和 sendSystemQuery 共享）
  const doChat = useCallback(async (userMsg, userTasks = []) => {
    setError('');

    const taskContext = buildTaskContext(userTasks);

    const history = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${taskContext}${userMsg}` },
    ];

    setMessages(prev => [...prev, { role: 'user', content: userMsg, actions: [] }]);
    setLoading(true);

    try {
      const rawAnswer = await callDeepSeek(history);
      const { cleanText, actions } = parseActions(rawAnswer);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanText || '（AI 没有返回内容）',
        actions: actions,
      }]);
    } catch (err) {
      console.error('AI 聊天错误:', err);
      setError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `抱歉，出错了：${err.message}`,
        actions: [],
      }]);
    } finally {
      setLoading(false);
    }
  }, [callDeepSeek, messages]);

  const sendMessage = useCallback(async (userTasks = []) => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    await doChat(userMsg, userTasks);
  }, [input, doChat]);

  const sendSystemQuery = useCallback(async (query, userTasks = []) => {
    await doChat(query, userTasks);
  }, [doChat]);

  // 监听 messages 变化，自动保存到 localStorage
  useEffect(() => {
    try {
      const toSave = messages.slice(-30);
      localStorage.setItem('ima_chat_messages', JSON.stringify(toSave));
    } catch {}
  }, [messages]);

  const clearMessages = useCallback(() => {
    localStorage.removeItem('ima_chat_messages');
    setMessages([DEFAULT_MSG]);
    setError('');
  }, [DEFAULT_MSG]);

  return {
    messages, input, setInput, loading, error,
    sendMessage, sendSystemQuery, clearMessages
  };
}

// 解析 AI 回复中的操作标记，支持嵌套 JSON
function parseActions(text) {
  const actions = [];
  const marker = '[[';
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const start = text.indexOf(marker, searchFrom);
    if (start === -1) break;

    // 找到 | 分隔符后的 { 开始位置
    const pipeIdx = text.indexOf('|', start);
    if (pipeIdx === -1) { searchFrom = start + 2; continue; }

    const actionType = text.slice(start + 2, pipeIdx);
    if (!['ADD_TASK', 'COMPLETE_TASK', 'DELETE_TASK', 'UPDATE_TASK'].includes(actionType)) {
      searchFrom = start + 2; continue;
    }

    // 找到匹配的 } 和 ]] — 处理嵌套 JSON
    let braceCount = 0;
    let braceStart = -1;
    let braceEnd = -1;
    for (let i = pipeIdx; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) braceStart = i;
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          braceEnd = i;
          break;
        }
      }
    }
    if (braceStart === -1 || braceEnd === -1 || text.slice(braceEnd + 1, braceEnd + 3) !== ']]') {
      searchFrom = start + 2; continue;
    }

    try {
      const payloadStr = text.slice(braceStart, braceEnd + 1);
      const payload = JSON.parse(payloadStr);
      actions.push({ type: actionType, payload });
      searchFrom = braceEnd + 3;
    } catch {
      searchFrom = start + 2;
    }
  }

  const cleanText = text.replace(/\[\[(ADD_TASK|COMPLETE_TASK|DELETE_TASK|UPDATE_TASK)\|\{[^]*?\}\]\]/g, '').trim();
  return { cleanText, actions };
}
