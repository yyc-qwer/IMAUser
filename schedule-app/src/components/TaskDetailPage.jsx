import { useState } from "react";
import NotionBlockEditor from "./NotionBlockEditor";
import { sendPushPlus } from "../hooks/useSettings";
import { fmtDate } from "../utils/dateUtils";

export default function TaskDetailPage({ task, isMobile, onBack, pushplusToken }) {
  const [pushStatus, setPushStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority || "medium"];
  const priorityColor = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" }[task.priority || "medium"];

  const handlePush = async () => {
    if (!pushplusToken || pushStatus === 'loading') return;
    setPushStatus('loading');
    try {
      const content = `<b>${task.title}</b><br/>`
        + (task.priority ? `优先级：${priorityLabel}<br/>` : '')
        + (task.endDate ? `截止日期：${fmtDate(task.endDate)}<br/>` : '')
        + (task.notes ? `<br/>备注：${task.notes}` : '')
        + `<br/><small>来自 IMAUser 智能日程看板</small>`;
      await sendPushPlus(pushplusToken, task.title, content);
      setPushStatus('success');
      setTimeout(() => setPushStatus(null), 2500);
    } catch (err) {
      setPushStatus('error');
      setTimeout(() => setPushStatus(null), 3000);
    }
  };

  return (
    <div className="task-detail-page">
      <div className="task-detail-header">
        <button className="btn-secondary" onClick={onBack}>← 返回任务列表</button>
        <div className="task-detail-meta">
          <span className="task-priority-badge" style={{ background: priorityColor + "22", color: priorityColor, border: `1px solid ${priorityColor}44` }}>
            {priorityLabel}优先级
          </span>
          {task.endDate && <span className="task-date-badge">截止: {fmtDate(task.endDate)}</span>}
          {pushplusToken && (
            <button
              className={`push-wechat-btn ${pushStatus || ''}`}
              onClick={handlePush}
              disabled={pushStatus === 'loading'}
              title="推送到微信"
            >
              {pushStatus === 'loading' ? '推送中...' : pushStatus === 'success' ? '✓ 已推送' : pushStatus === 'error' ? '✕ 失败' : '📱 推送到微信'}
            </button>
          )}
        </div>
      </div>

      <div className="task-detail-title">{task.title}</div>

      <div className="task-detail-editor">
        <NotionBlockEditor taskId={task.id} isMobile={isMobile} />
      </div>
    </div>
  );
}
