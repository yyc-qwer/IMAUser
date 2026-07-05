import { useAIChat } from '../hooks/useAIChat';

export default function AIChat({ tasks, taskTypes, addTask, updateTask, deleteTask, toggleComplete, refresh }) {
  const { messages, input, setInput, loading, sendMessage, sendSystemQuery, clearMessages } = useAIChat();

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(tasks);
  };

  // 执行 AI 建议的操作
  const executeAction = async (action) => {
    try {
      switch (action.type) {
        case 'ADD_TASK': {
          const p = action.payload;
          // 查找类型ID
          const type = taskTypes.find(t => t.name === p.typeName);
          const typeId = type ? type.id : (taskTypes[0]?.id || null);

          await addTask({
            title: p.title,
            typeId: typeId,
            endDate: p.endDate || null,
            priority: p.priority || 'medium',
            notes: p.notes || `由 AI 助手添加`,
            source: 'ai',
          });
          alert(`✅ 已添加任务：${p.title}`);
          await refresh();
          break;
        }
        case 'COMPLETE_TASK': {
          const task = tasks.find(t => t.id === action.payload.id);
          if (task && !task.completed) {
            await toggleComplete(action.payload.id);
            alert(`✅ 已标记完成`);
            await refresh();
          } else if (task?.completed) {
            alert('该任务已完成');
          } else {
            alert('未找到该任务');
          }
          break;
        }
        case 'DELETE_TASK': {
          const task = tasks.find(t => t.id === action.payload.id);
          if (task && confirm(`确定删除任务「${task.title}」吗？`)) {
            await deleteTask(action.payload.id);
            alert(`✅ 已删除`);
            await refresh();
          }
          break;
        }
        case 'UPDATE_TASK': {
          const p = action.payload;
          const updates = {};
          if (p.title) updates.title = p.title;
          if (p.endDate) updates.endDate = p.endDate;
          if (p.priority) updates.priority = p.priority;
          if (p.notes) updates.notes = p.notes;

          await updateTask(p.id, updates);
          alert(`✅ 已更新任务`);
          await refresh();
          break;
        }
        default:
          alert('未知操作类型');
      }
    } catch (err) {
      alert('执行失败：' + err.message);
    }
  };

  // 快捷指令
  const quickActions = [
    { label: '📊 分析日程', query: '请分析我当前的日程安排，给出优化建议。' },
    { label: '🔥 紧急任务', query: '请帮我找出最紧急、最需要优先处理的任务。' },
    { label: '📅 本周规划', query: '基于我当前的任务，帮我制定本周的学习计划。' },
    { label: '🆕 添加建议', query: '看看我当前的任务列表，建议我还需要添加什么任务吗？如果有请直接帮我添加。' },
  ];

  const handleQuickAction = (query) => {
    sendSystemQuery(query, tasks);
  };

  const getActionLabel = (action) => {
    switch (action.type) {
      case 'ADD_TASK': return `➕ 添加「${action.payload.title}」`;
      case 'COMPLETE_TASK': return `✅ 标记完成`;
      case 'DELETE_TASK': return `🗑️ 删除任务`;
      case 'UPDATE_TASK': return `✏️ 更新任务`;
      default: return '执行操作';
    }
  };

  return (
    <div className="ai-chat-container">
      <div className="ai-chat-header">
        <h2>AI 助手</h2>
        <button className="btn-secondary" onClick={clearMessages} title="清空对话">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>

      {/* 快捷指令 */}
      <div className="ai-chat-quick-actions">
        {quickActions.map((qa, i) => (
          <button key={i} className="ai-chat-quick-btn" onClick={() => handleQuickAction(qa.query)} disabled={loading}>
            {qa.label}
          </button>
        ))}
      </div>

      <div className="ai-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-chat-message ${msg.role}`}>
            <div className="ai-chat-avatar">
              {msg.role === 'user' ? '我' : 'AI'}
            </div>
            <div className="ai-chat-bubble">
              {msg.content}
              {/* 操作按钮 */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="ai-chat-actions">
                  {msg.actions.map((action, idx) => (
                    <button key={idx} className="ai-chat-action-btn" onClick={() => executeAction(action)}>
                      {getActionLabel(action)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-chat-message assistant">
            <div className="ai-chat-avatar">AI</div>
            <div className="ai-chat-bubble loading">
              <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
            </div>
          </div>
        )}
      </div>

      <form className="ai-chat-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="输入消息，或试试快捷指令..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}
