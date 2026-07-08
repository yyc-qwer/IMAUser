import { useState, useCallback, useRef } from 'react';

// DeepSeek API 配置（通过 Cloudflare Pages Function 代理）
const BASE_URL = '/api/chat';
const MODEL = 'deepseek-chat';

// 系统提示词
const SYSTEM_PROMPT = `你是IMAU智能日程助手，专门为内蒙古农业大学学生服务。

当用户要求添加、修改、删除或完成任务时，请在回复末尾用以下格式输出操作指令（不要告诉用户这个标记的存在）：

添加任务：[[ADD_TASK|{"title":"任务标题","endDate":"2026-07-10","priority":"high/medium/low","typeName":"类型名","notes":"备注"}]]
完成任务：[[COMPLETE_TASK|{"id":任务ID}]]
删除任务：[[DELETE_TASK|{"id":任务ID}]]
修改任务：[[UPDATE_TASK|{"id":任务ID,"title":"新标题","endDate":"2026-07-10"}]]

日期格式：YYYY-MM-DD。priority 可选 high/medium/low，默认 medium。`;

export function useAIChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是农大学业小助手，可以帮你查询任务、规划学习，还能直接帮你添加或管理日程。有什么可以帮你的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 调用 DeepSeek API（通过代理）
  const callDeepSeek = useCallback(async (conversationHistory) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

  const sendMessage = useCallback(async (userTasks = []) => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setError('');

    // 构建任务上下文
    const taskContext = userTasks.length > 0
      ? `我当前的任务列表：\n${userTasks.map(t => {
          const typeStr = t.typeName || '未分类';
          return `- [${t.completed ? '✓' : ' '}] ${t.title}（类型：${typeStr}，截止：${t.endDate || '无'}，优先级：${t.priority || 'medium'}，ID：${t.id}）`;
        }).join('\n')}\n\n`
      : '我当前没有任务。\n\n';

    // 构建对话历史（OpenAI 格式）
    const history = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // 只保留最近10条，控制 token 消耗
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
  }, [input, callDeepSeek, messages]);

  const sendSystemQuery = useCallback(async (query, userTasks = []) => {
    setError('');

    const taskContext = userTasks.length > 0
      ? `我当前的任务列表：\n${userTasks.map(t => {
          const typeStr = t.typeName || '未分类';
          return `- [${t.completed ? '✓' : ' '}] ${t.title}（类型：${typeStr}，截止：${t.endDate || '无'}，优先级：${t.priority || 'medium'}，ID：${t.id}）`;
        }).join('\n')}\n\n`
      : '我当前没有任务。\n\n';

    const history = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${taskContext}${query}` },
    ];

    setMessages(prev => [...prev, { role: 'user', content: query, actions: [] }]);
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

  const clearMessages = useCallback(() => {
    setMessages([
      { role: 'assistant', content: '你好！我是农大学业小助手，可以帮你查询任务、规划学习，还能直接帮你添加或管理日程。有什么可以帮你的吗？' }
    ]);
    setError('');
  }, []);

  return {
    messages,
    input,
    setInput,
    loading,
    error,
    sendMessage,
    sendSystemQuery,
    clearMessages
  };
}

// 解析 AI 回复中的操作标记
function parseActions(text) {
  const actionRegex = /\[\[(ADD_TASK|COMPLETE_TASK|DELETE_TASK|UPDATE_TASK)\|(\{[^}]+\})\]\]/g;
  const actions = [];
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const actionType = match[1];
      const payload = JSON.parse(match[2]);
      actions.push({ type: actionType, payload });
    } catch {
      // 解析失败，忽略
    }
  }

  const cleanText = text.replace(actionRegex, '').trim();
  return { cleanText, actions };
}