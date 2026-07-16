import { useState, useCallback } from "react";
import NotionBlockEditor from "./NotionBlockEditor";
import { sendPushPlus } from "../hooks/useSettings";
import { fmtDate } from "../utils/dateUtils";

export default function TaskDetailPage({
  task, isMobile, onBack, pushplusToken,
  toggleComplete, deleteTask, updateTask, getTypeName, getTypeColor,
}) {
  const [pushStatus, setPushStatus] = useState(null);
  const [notesEdit, setNotesEdit] = useState(task.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority || "medium"];
  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" }[task.priority || "medium"];
  const typeName = getTypeName ? getTypeName(task.typeId) : "";
  const typeColor = getTypeColor ? getTypeColor(task.typeId) : "var(--text3)";
  const isCourse = task.source === "course";
  const isProject = typeName === "项目";
  const [showNotion, setShowNotion] = useState(isProject);

  // 解析课程信息（从 notes 字段 "老师 | 地点 | 第1节 | 08:00-08:45"）
  const courseInfo = (() => {
    if (!isCourse || !task.notes) return null;
    const parts = task.notes.split("|").map((s) => s.trim());
    return {
      teacher: parts[0] || "",
      location: parts[1] || "",
      period: parts[2] || "",
      timeRange: parts[3] || "",
    };
  })();

  const handlePush = async () => {
    if (!pushplusToken || pushStatus === "loading") return;
    setPushStatus("loading");
    try {
      const content =
        `<b>${task.title}</b><br/>` +
        (task.priority ? `优先级：${priorityLabel}<br/>` : "") +
        (task.endDate ? `截止日期：${fmtDate(task.endDate)}<br/>` : "") +
        (task.notes ? `<br/>备注：${task.notes}` : "") +
        `<br/><small>来自 IMAUser 智能日程看板</small>`;
      await sendPushPlus(pushplusToken, task.title, content);
      setPushStatus("success");
      setTimeout(() => setPushStatus(null), 2500);
    } catch {
      setPushStatus("error");
      setTimeout(() => setPushStatus(null), 3000);
    }
  };

  const handleSaveNotes = useCallback(async () => {
    if (notesEdit === (task.notes || "")) return;
    setSavingNotes(true);
    await updateTask(task.id, { notes: notesEdit });
    setSavingNotes(false);
  }, [notesEdit, task.notes, task.id, updateTask]);

  const handleToggleComplete = async () => {
    await toggleComplete(task.id);
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个任务吗？")) return;
    await deleteTask(task.id);
    onBack();
  };

  return (
    <div className="task-detail-page">
      {/* Header */}
      <div className="task-detail-header">
        <button className="btn-secondary" onClick={onBack}>← 返回</button>
        <div className="task-detail-meta">
          <span
            className="task-priority-badge"
            style={{
              background: priorityColor + "22",
              color: priorityColor,
              border: `1px solid ${priorityColor}44`,
            }}
          >
            {priorityLabel}
          </span>
          {task.endDate && <span className="task-date-badge">截止: {fmtDate(task.endDate)}</span>}
        </div>
      </div>

      {/* Title */}
      <div className="task-detail-title">{task.title}</div>

      {/* Info Card */}
      <div className="task-info-card">
        <div className="task-info-row">
          <span className="task-info-label">类型</span>
          <span className="task-info-value" style={{ color: typeColor }}>
            {typeName || "未分类"}
          </span>
        </div>
        {task.startDate && (
          <div className="task-info-row">
            <span className="task-info-label">开始日期</span>
            <span className="task-info-value">{fmtDate(task.startDate)}</span>
          </div>
        )}
        {task.endDate && (
          <div className="task-info-row">
            <span className="task-info-label">截止日期</span>
            <span className="task-info-value">{fmtDate(task.endDate)}</span>
          </div>
        )}

        {/* 课程专属信息 */}
        {isCourse && courseInfo && (
          <>
            {courseInfo.teacher && (
              <div className="task-info-row">
                <span className="task-info-label">任课教师</span>
                <span className="task-info-value">{courseInfo.teacher}</span>
              </div>
            )}
            {courseInfo.location && (
              <div className="task-info-row">
                <span className="task-info-label">上课地点</span>
                <span className="task-info-value">{courseInfo.location}</span>
              </div>
            )}
            {courseInfo.period && (
              <div className="task-info-row">
                <span className="task-info-label">节次</span>
                <span className="task-info-value">{courseInfo.period}</span>
              </div>
            )}
            {courseInfo.timeRange && (
              <div className="task-info-row">
                <span className="task-info-label">时间</span>
                <span className="task-info-value">{courseInfo.timeRange}</span>
              </div>
            )}
          </>
        )}

        {/* 备注编辑（非课程、非项目任务） */}
        {!isCourse && !isProject && (
          <div className="task-info-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <span className="task-info-label">备注</span>
            <textarea
              className="task-notes-edit"
              value={notesEdit}
              onChange={(e) => setNotesEdit(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="添加备注..."
              rows={3}
            />
            {savingNotes && <span style={{ fontSize: 12, color: "var(--text3)" }}>保存中...</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="task-detail-actions">
        <button
          className={`btn-primary ${task.completed ? "btn-secondary" : ""}`}
          onClick={handleToggleComplete}
        >
          {task.completed ? "标记为未完成" : "标记为已完成"}
        </button>
        {pushplusToken && (
          <button
            className={`push-wechat-btn ${pushStatus || ""}`}
            onClick={handlePush}
            disabled={pushStatus === "loading"}
            title="推送到微信"
          >
            {pushStatus === "loading"
              ? "推送中..."
              : pushStatus === "success"
              ? "✓ 已推送"
              : pushStatus === "error"
              ? "✕ 失败"
              : "📱 推送到微信"}
          </button>
        )}
        <button className="btn-danger" onClick={handleDelete}>
          删除任务
        </button>
      </div>

      {/* Notion 编辑器入口（非课程任务） */}
      {!isCourse && (
        <div className="task-notion-section">
          {!showNotion ? (
            <button className="task-notion-toggle" onClick={() => setShowNotion(true)}>
              <span className="task-notion-toggle-icon">📝</span>
              <span>打开详细笔记（Notion 风格编辑器）</span>
            </button>
          ) : (
            <>
              <div className="task-notion-header">
                <span>详细笔记</span>
                <button className="btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setShowNotion(false)}>
                  收起
                </button>
              </div>
              <div className="task-detail-editor">
                <NotionBlockEditor taskId={task.id} isMobile={isMobile} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
