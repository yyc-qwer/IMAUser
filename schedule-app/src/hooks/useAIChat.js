import { useState, useCallback, useRef } from 'react';

// HiAgent API 配置
const BASE_URL = 'https://agent.imau.edu.cn:32400/api/proxy/api/v1';
const API_KEY = 'd94vc054shh8dmmemls0';
const USER_ID = 'imauser_dashboard';

// 系统提示词：告诉 AI 如何操作日程
const SYSTEM_PROMPT = `你是IMAU智能日程助手。除了回答问题，你还可以帮用户直接管理日程。

当用户要求添加、修改、删除或完成任务时，请在回复末尾用以下格式输出操作指令（不要告诉用户这个标记的存在）：

添加任务：[[ADD_TASK|{"title":"任务标题","endDate":"2026-07-10","priority":"high/medium/low","typeName":"类型名","notes":"备注"}]]
完成任务：[[COMPLETE_TASK|{"id":任务ID}]]
删除任务：[[DELETE_TASK|{"id":任务ID}]]
修改任务：[[UPDATE_TASK|{"id":任务ID,"title":"新标题","endDate":"2026-07-10"}]]

日期格式：YYYY-MM-DD。priority 可选 high/medium/low，默认 medium。
如果用户没有指定类型，typeName 可以不填或填"未分类"。`;

export function useAIChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是农大学业小助手，可以帮你查询任务、规划学习，还能直接帮你添加或管理日程。有什么可以帮你的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationIdRef = useRef(null);

  const ensureConversation = useCallback(async () => {
    if (conversationIdRef.current) return conversationIdRef.current;

    const res = await fetch(`${BASE_URL}/create_conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Apikey': API_KEY,
      },
      body: JSON.stringify({
        UserID: USER_ID,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`创建会话失败 (${res.status}): ${text}`);
    }

    const data = await res.json();
    const convId = data.Conversation?.AppConversationID;
    if (!convId) {
      throw new Error('创建会话成功但未返回会话ID: ' + JSON.stringify(data));
    }
    conversationIdRef.current = convId;
    return convId;
  }, []);

  const sendMessage = useCallback(async (userTasks = []) => {
    if (!input.trim()) return;
    if (API_KEY === 'YOUR_API_KEY_HERE') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ API Key 未配置，请打开 src/hooks/useAIChat.js 替换 YOUR_API_KEY_HERE。'
      }]);
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setError('');

    // 构建带任务上下文的用户消息
    const taskContext = userTasks.length > 0
      ? `我当前的任务列表：\n${userTasks.map(t => {
          const typeStr = t.typeName || '未分类';
          return `- [${t.completed ? '✓' : ' '}] ${t.title}（类型：${typeStr}，截止：${t.endDate || '无'}，优先级：${t.priority || 'medium'}，ID：${t.id}）`;
        }).join('\n')}\n\n`
      : '我当前没有任务。\n\n';

    const fullQuery = `${taskContext}用户问题：${userMsg}\n\n（系统提示：${SYSTEM_PROMPT}）`;

    setMessages(prev => [...prev, { role: 'user', content: userMsg, actions: [] }]);
    setLoading(true);

    try {
      const convId = await ensureConversation();

      const res = await fetch(`${BASE_URL}/chat_query_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Apikey': API_KEY,
        },
        body: JSON.stringify({
          UserID: USER_ID,
          AppConversationID: convId,
          Query: fullQuery,
          ResponseMode: 'blocking',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API 错误 (${res.status}): ${text}`);
      }

      const data = await res.json();
      const rawAnswer = data.answer || data.Answer || data.data?.answer || '';

      // 解析操作标记
      const { cleanText, actions } = parseActions(rawAnswer);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanText,
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
  }, [input, ensureConversation]);

  const sendSystemQuery = useCallback(async (query, userTasks = []) => {
    setError('');

    const taskContext = userTasks.length > 0
      ? `我当前的任务列表：\n${userTasks.map(t => {
          const typeStr = t.typeName || '未分类';
          return `- [${t.completed ? '✓' : ' '}] ${t.title}（类型：${typeStr}，截止：${t.endDate || '无'}，优先级：${t.priority || 'medium'}，ID：${t.id}）`;
        }).join('\n')}\n\n`
      : '我当前没有任务。\n\n';

    const fullQuery = `${taskContext}${query}\n\n（系统提示：${SYSTEM_PROMPT}）`;

    setMessages(prev => [...prev, { role: 'user', content: query, actions: [] }]);
    setLoading(true);

    try {
      const convId = await ensureConversation();

      const res = await fetch(`${BASE_URL}/chat_query_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Apikey': API_KEY,
        },
        body: JSON.stringify({
          UserID: USER_ID,
          AppConversationID: convId,
          Query: fullQuery,
          ResponseMode: 'blocking',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API 错误 (${res.status}): ${text}`);
      }

      const data = await res.json();
      const rawAnswer = data.answer || data.Answer || data.data?.answer || '';
      const { cleanText, actions } = parseActions(rawAnswer);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanText,
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
  }, [ensureConversation]);

  const clearMessages = useCallback(() => {
    setMessages([
      { role: 'assistant', content: '你好！我是农大学业小助手，可以帮你查询任务、规划学习，还能直接帮你添加或管理日程。有什么可以帮你的吗？' }
    ]);
    conversationIdRef.current = null;
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

  // 移除操作标记，保留干净的文本
  const cleanText = text.replace(actionRegex, '').trim();

  return { cleanText, actions };
}
