import NotionBlockEditor from "./NotionBlockEditor";

export default function TaskDetailPage({ task, isMobile, onBack }) {
  const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority || "medium"];
  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" }[task.priority || "medium"];

  return (
    <div className="task-detail-page">
      <div className="task-detail-header">
        <button className="btn-secondary" onClick={onBack}>← 返回任务列表</button>
        <div className="task-detail-meta">
          <span className="task-priority-badge" style={{ background: priorityColor + "22", color: priorityColor, border: `1px solid ${priorityColor}44` }}>
            {priorityLabel}优先级
          </span>
          {task.endDate && <span className="task-date-badge">截止: {task.endDate}</span>}
        </div>
      </div>

      <div className="task-detail-title">{task.title}</div>

      <div className="task-detail-editor">
        <NotionBlockEditor taskId={task.id} isMobile={isMobile} />
      </div>
    </div>
  );
}
