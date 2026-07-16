import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fmtDate } from "../utils/dateUtils";
import PlusMenu from "./PlusMenu";
import TimelineMemoView from "./TimelineMemoView";
import MonthView from "./MonthView";

const COLORS = ["#5b9bd5", "#d9544f", "#3d7a5c", "#d4a853", "#7c6fb0", "#d4668e", "#3ba3b8", "#d4855e"];
const MODES = ["list", "timeline", "month"];

export default function TasksPage({
  tasks, taskTypes, activeTasks, completedTasks, trashTasks,
  addTask, updateTask, deleteTask, restoreTask, permanentDelete, toggleComplete,
  addTaskType, deleteTaskType, refresh,
  getSubtasks, addSubtask, toggleSubtask, deleteSubtask,
  openNew, openEdit, getTypeName, getTypeColor,
  pushplusToken,
}) {
  const navigate = useNavigate();
  const [taskViewMode, setTaskViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [expandedTask, setExpandedTask] = useState(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState(COLORS[0]);
  const [showTrash, setShowTrash] = useState(false);

  const switchView = useCallback((dir) => {
    setTaskViewMode(prev => {
      const idx = MODES.indexOf(prev);
      const next = (idx + dir + MODES.length) % MODES.length;
      return MODES[next];
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); switchView(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); switchView(-1); }
      else if (e.key === 'Enter' && taskViewMode === 'list') { e.preventDefault(); openNew(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [switchView, taskViewMode, openNew]);

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    try {
      await addTaskType({ name: newTypeName.trim(), color: newTypeColor });
      setNewTypeName("");
      setNewTypeColor(COLORS[0]);
    } catch (err) {
      alert('添加类型失败：' + (err.message || '未知错误，请检查网络或刷新重试'));
    }
  };

  const filteredActive = activeTasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType && String(t.typeId) !== filterType) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });
  const filteredCompleted = completedTasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType && String(t.typeId) !== filterType) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <>
      <header className="main-header">
        {taskViewMode === "list" && <h2>所有任务</h2>}
        {taskViewMode === "timeline" && <h2>日程视图</h2>}
        {taskViewMode === "month" && <h2>月视图</h2>}
        <div className="header-actions">
          {taskViewMode === "list" && (
            <PlusMenu
              onNewTask={openNew}
              taskTypes={taskTypes}
              newTypeName={newTypeName}
              setNewTypeName={setNewTypeName}
              newTypeColor={newTypeColor}
              setNewTypeColor={setNewTypeColor}
              onAddType={handleAddType}
              onDeleteType={deleteTaskType}
              COLORS={COLORS}
            />
          )}
          {taskViewMode !== "list" && (
            <button className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }} onClick={openNew} title="新建任务">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              新建
            </button>
          )}
          <button
            className="btn-secondary view-toggle-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
            onClick={() => switchView(1)}
            title={`当前：${taskViewMode === "list" ? "列表" : taskViewMode === "timeline" ? "日程" : "月份"} → 点击/按D切换 (A/D 或 ←/→)`}
          >
            {taskViewMode === "list" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            )}
            {taskViewMode === "timeline" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            )}
            {taskViewMode === "month" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
            )}
            {taskViewMode === "list" ? "列表" : taskViewMode === "timeline" ? "日程" : "月份"}
          </button>
        </div>
      </header>

      {taskViewMode === "list" && (<>
        <div className="filter-bar">
          <input className="search-input" placeholder="搜索任务..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">所有类型</option>
            {taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">所有优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          {(searchQuery || filterType || filterPriority) && (
            <button className="btn-secondary" onClick={() => { setSearchQuery(""); setFilterType(""); setFilterPriority(""); }}>清除筛选</button>
          )}
        </div>

        {filteredActive.length === 0 && filteredCompleted.length === 0 && (
          <div className="empty">
            {searchQuery || filterType || filterPriority ? "没有匹配的任务" : "还没有任务，点击\"新建任务\"开始"}
          </div>
        )}

        {filteredActive.length > 0 && (
          <section className="task-section">
            <h3 className="section-title">进行中 ({filteredActive.length})</h3>
            <div className="task-grid">
              {filteredActive.map(t => (
                <TaskCard key={t.id} task={t} typeName={getTypeName(t.typeId)} color={getTypeColor(t.typeId)}
                  onToggle={() => toggleComplete(t.id)} onEdit={() => openEdit(t)} onDelete={() => deleteTask(t.id)}
                  onOpenDetail={() => navigate("/task/" + t.id)}
                  pushplusToken={pushplusToken} />
              ))}
            </div>
          </section>
        )}

        {filteredCompleted.length > 0 && (
          <section className="task-section">
            <h3 className="section-title">已完成 ({filteredCompleted.length})</h3>
            <div className="task-grid">
              {filteredCompleted.map(t => (
                <TaskCard key={t.id} task={t} typeName={getTypeName(t.typeId)} color={getTypeColor(t.typeId)} done
                  onToggle={() => toggleComplete(t.id)} onEdit={() => openEdit(t)} onDelete={() => deleteTask(t.id)}
                  onOpenDetail={() => navigate("/task/" + t.id)}
                  pushplusToken={pushplusToken} />
              ))}
            </div>
          </section>
        )}

        {/* 回收站 — 用 trashTasks 完整对象 */}
        {trashTasks.length > 0 && (
          <section className="task-section trash-section">
            <h3 className="section-title" style={{ cursor: 'pointer' }} onClick={() => setShowTrash(!showTrash)}>
              🗑️ 回收站 ({trashTasks.length}) {showTrash ? '▲' : '▼'}
            </h3>
            {showTrash && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trashTasks.map(t => (
                  <div key={t.id} className="trash-item">
                    <span className="trash-title">{t.title}</span>
                    <button className="btn-secondary btn-sm" onClick={() => restoreTask(t.id)}>恢复</button>
                    <button className="btn-secondary btn-sm danger-btn" onClick={() => { if (confirm('确定永久删除？')) permanentDelete(t.id); }}>永久删除</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </>)}

      {taskViewMode === "timeline" && (
        <TimelineMemoView
          tasks={tasks}
          taskTypes={taskTypes}
          getTypeName={getTypeName}
          getTypeColor={getTypeColor}
          onOpenDetail={(t) => navigate("/task/" + t.id)}
          onQuickAdd={async ({ title, date, periodIndex, periodName, periodTime, typeId }) => {
            await addTask({
              title,
              typeId: typeId || null,
              startDate: date,
              endDate: date,
              notes: periodName ? `${periodName} (${periodTime}) 的日程` : "",
              priority: "medium",
              source: "manual",
            });
          }}
        />
      )}

      {taskViewMode === "month" && (
        <MonthView
          tasks={tasks}
          taskTypes={taskTypes}
          getTypeName={getTypeName}
          getTypeColor={getTypeColor}
          onOpenDetail={(t) => navigate("/task/" + t.id)}
          onQuickAdd={async ({ title, date, typeId }) => {
            await addTask({
              title,
              typeId: typeId || null,
              startDate: date,
              endDate: date,
              notes: "",
              priority: "medium",
              source: "manual",
            });
          }}
        />
      )}
    </>
  );
}

function TaskCard({ task, typeName, color, done, onToggle, onEdit, onDelete, onOpenDetail, pushplusToken }) {
  const [completing, setCompleting] = useState(false);

  const handleToggle = async () => {
    if (completing) return;
    setCompleting(true);
    try { await onToggle(); } catch {}
    setCompleting(false);
  };

  const timeStr = task.startDate
    ? (task.endDate && task.endDate !== task.startDate
      ? `${fmtDate(task.startDate)} ~ ${fmtDate(task.endDate)}`
      : fmtDate(task.startDate))
    : '';

  return (
    <div className={`task-card${done ? " done" : ""}`} style={{ borderLeftColor: done ? undefined : color }}>
      <div className="task-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <input
            type="checkbox"
            checked={done}
            onChange={handleToggle}
            disabled={completing}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <h4 className="task-title" style={{ cursor: 'pointer', margin: 0 }} onClick={onOpenDetail}>{task.title}</h4>
        </div>
        <div className="task-actions">
          <button className="btn-icon-sm" onClick={onEdit} title="编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="btn-icon-sm" onClick={onDelete} title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
      <div className="task-meta" style={{ paddingLeft: 24 }}>
        {timeStr && <span>{timeStr}</span>}
        {task.courseLocation && <span>📍 {task.courseLocation}</span>}
        {task.notes && <span style={{ color: 'var(--text3)' }}>{task.notes}</span>}
      </div>
    </div>
  );
}
