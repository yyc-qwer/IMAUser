import { useState, useEffect, useCallback } from "react";

export default function SubtaskList({ taskId, getSubtasks, addSubtask, toggleSubtask, deleteSubtask, onUpdate }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    const list = await getSubtasks(taskId);
    setSubtasks(list);
  }, [taskId, getSubtasks]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addSubtask(taskId, newTitle.trim());
    setNewTitle('');
    await load();
    onUpdate?.();
  };

  const handleToggle = async (id) => {
    await toggleSubtask(id);
    await load();
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    await deleteSubtask(id);
    await load();
    onUpdate?.();
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const progress = subtasks.length ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className="subtask-list">
      {subtasks.length > 0 && (
        <div className="subtask-progress">
          <div className="subtask-progress-bar" style={{ width: `${progress}%` }} />
          <span className="subtask-progress-text">{completedCount}/{subtasks.length}</span>
        </div>
      )}
      {subtasks.map(st => (
        <div key={st.id} className={`subtask-item ${st.completed ? 'done' : ''}`}>
          <input type="checkbox" checked={st.completed} onChange={() => handleToggle(st.id)} />
          <span className="subtask-title">{st.title}</span>
          <button className="btn-icon-sm" onClick={() => handleDelete(st.id)} title="删除">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
      <div className="subtask-add">
        <input placeholder="添加子任务..." value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button className="btn-primary" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
}
