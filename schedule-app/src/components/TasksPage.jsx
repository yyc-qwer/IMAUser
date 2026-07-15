import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCountdown, fmtDate } from "../utils/dateUtils";
import { sendPushPlus } from "../hooks/useSettings";
import PlusMenu from "./PlusMenu";
import TimelineMemoView from "./TimelineMemoView";
import MonthView from "./MonthView";

const COLORS = ["#5b9bd5", "#d9544f", "#3d7a5c", "#d4a853", "#7c6fb0", "#d4668e", "#3ba3b8", "#d4855e"];

export default function TasksPage({
  tasks, taskTypes, activeTasks, completedTasks, deletedTasks,
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
            onClick={() => {
              const modes = ["list", "timeline", "month"];
              const idx = modes.indexOf(taskViewMode);
              setTaskViewMode(modes[(idx + 1) % modes.length]);
            }}
            title={`当前：${taskViewMode === "list" ? "列表" : taskViewMode === "timeline" ? "日程" : "月份"} → 点击切换`}
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
                  expanded={expandedTask === t.id}
                  onToggle={() => toggleComplete(t.id)} onEdit={() => openEdit(t)} onDelete={() => deleteTask(t.id)}
                  onExpand={() => setExpandedTask(expandedTask === t.id ? null : t.id)}
                  onOpenDetail={() => navigate("/task/" + t.id)}
                  pushplusToken={pushplusToken}
                  subtaskProps={{ getSubtasks, addSubtask, toggleSubtask, deleteSubtask }} />
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
                  expanded={expandedTask === t.id}
                  onToggle={() => toggleComplete(t.id)} onEdit={() => openEdit(t)} onDelete={() => deleteTask(t.id)}
                  onExpand={() => setExpandedTask(expandedTask === t.id ? null : t.id)}
                  onOpenDetail={() => navigate("/task/" + t.id)}
                  pushplusToken={pushplusToken}
                  subtaskProps={{ getSubtasks, addSubtask, toggleSubtask, deleteSubtask }} />
              ))}
            </div>
          </section>
        )}

        {/* 回收站 */}
        {deletedTasks.length > 0 && (
          <section className="task-section trash-section">
            <h3 className="section-title" style={{ cursor: 'pointer' }} onClick={() => setShowTrash(!showTrash)}>
              🗑️ 回收站 ({deletedTasks.length}) {showTrash ? '▲' : '▼'}
            </h3>
            {showTrash && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {deletedTasks.map(tid => {
                  const t = tasks.find(x => x.id === tid);
                  if (!t) return null;
                  return (
                    <div key={tid} className="trash-item">
                      <span className="trash-title">{t.title}</span>
                      <button className="btn-secondary btn-sm" onClick={async () => { await restoreTask(tid); }}>恢复</button>
                      <button className="btn-secondary btn-sm danger-btn" onClick={() => { if (window.confirm('确定永久删除？不可恢复！')) permanentDelete(tid); }}>永久删除</button>
                    </div>
                  );
                })}
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

function TaskCard({ task, typeName, color, done, onToggle, onEdit, onDelete, onExpand, onOpenDetail, expanded, pushplusToken, subtaskProps }) {
  const cd = formatCountdown(task);
  const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority || "medium"];
  const priorityColor = { high: "#f85149", medium: "#f0883e", low: "#58a6ff" }[task.priority || "medium"];
  const repeatLabel = { daily: "每天", weekly: "每周", none: "" }[task.repeatRule || "none"];
  const [pushState, setPushState] = useState(null);
  const [completing, setCompleting] = useState(false);

  const handlePush = async (e) => {
    e.stopPropagation();
    if (!pushplusToken || pushState === 'sending') return;
    setPushState('sending');
    try {
      await sendPushPlus(pushplusToken, task.title,
        `<b>${task.title}</b><br/>`
        + (task.endDate ? `截止：${fmtDate(task.endDate)}<br/>` : '')
        + (task.startDate ? `开始：${fmtDate(task.startDate)}<br/>` : '')
        + '<br/><small>来自 IMAUser</small>'
      );
      setPushState('ok');
      setTimeout(() => setPushState(null), 2000);
    } catch {
      setPushState('err');
      setTimeout(() => setPushState(null), 2500);
    }
  };

  const handleToggle = async () => {
    if (completing) return;
    setCompleting(true);
    try { await onToggle(); } catch {}
    setCompleting(false);
  };

  return (
    <div className={`task-card${done ? " done" : ""}`} style={{ borderLeftColor: done ? undefined : color }}>
      <div className="task-card-top">
        <div className="task-badges">
          <span className="task-type-badge" style={{ background: color }}>{typeName}</span>
          <span className="task-priority-badge" style={{ background: priorityColor + "22", color: priorityColor, border: `1px solid ${priorityColor}44` }}>{priorityLabel}</span>
          {repeatLabel && <span className="task-repeat-badge">{repeatLabel}</span>}
        </div>
        <div className="task-actions">
          {pushplusToken && !done && (
            <button className={`btn-icon-sm push-card-btn ${pushState || ''}`} onClick={handlePush} title="推送到微信">
              {pushState === 'sending' ? '⏳' : pushState === 'ok' ? '✓' : pushState === 'err' ? '✕' : '📱'}
            </button>
          )}
          <button className="btn-icon-sm" onClick={onEdit} title="编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="btn-icon-sm" onClick={onDelete} title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
      <h4 className="task-title" style={{ cursor: 'pointer' }} onClick={onOpenDetail} title="点击查看详情">{task.title}</h4>
      <div className="task-meta">
        {task.startDate && <span>开始: {fmtDate(task.startDate)}</span>}
        {task.endDate && <span>截止: {fmtDate(task.endDate)}</span>}
        {task.reminderAt && <span className="reminder-tag">提醒: {new Date(task.reminderAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <div className="task-bottom">
        <span className={`countdown${cd.urgent ? " urgent" : ""}`}>{cd.text}</span>
        {!done && (
          <button className={`toggle-btn${completing ? ' loading' : ''}`} onClick={handleToggle} disabled={completing}>
            {completing ? '⏳ 处理中...' : '✓ 完成'}
          </button>
        )}
      </div>
    </div>
  );
}
