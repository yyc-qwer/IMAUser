import { useState, useRef, useEffect } from "react";

// 每小时时间轴：6:00 ~ 23:00
function generateHours() {
  const hours = [];
  for (let h = 6; h <= 23; h++) {
    const label = `${String(h).padStart(2, '0')}:00`;
    const next = `${String(h + 1).padStart(2, '0')}:00`;
    hours.push({ id: h, label, start: label, end: next });
  }
  return hours;
}

const HOURS = generateHours();

export default function TimelineMemoView({
  tasks, taskTypes, getTypeName, getTypeColor,
  onOpenEdit, onToggleComplete, onOpenDetail,
  onQuickAdd,
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quickAddOpen, setQuickAddOpen] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTypeId, setQuickTypeId] = useState(null);
  const timelineRef = useRef(null);

  // 滚动到当前小时
  useEffect(() => {
    if (timelineRef.current) {
      const now = new Date();
      if (selectedDate === now.toISOString().slice(0, 10)) {
        const row = timelineRef.current.querySelector(`[data-hour="${now.getHours()}"]`);
        if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedDate]);

  // 当天任务
  const dayTasks = tasks.filter(t => {
    if (!t.startDate && !t.endDate) return false;
    if (t.startDate && t.startDate > selectedDate) return false;
    if (t.endDate && t.endDate < selectedDate) return false;
    return true;
  });

  const handleQuickAdd = () => {
    if (!quickTitle.trim() || !quickAddOpen) return;
    onQuickAdd({
      title: quickTitle.trim(),
      date: quickAddOpen.date,
      hour: quickAddOpen.hour,
      hourLabel: quickAddOpen.hourLabel,
      typeId: quickTypeId,
    });
    setQuickTitle("");
    setQuickTypeId(null);
    setQuickAddOpen(null);
  };

  const changeDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === todayStr;
  const dateLabel = isToday ? "今天" : selectedDate;

  return (
    <>
      <div className="timeline-layout">
        <div className="timeline-panel" ref={timelineRef}>
          <div className="date-navigator" style={{ marginBottom: 12 }}>
            <button className="btn-icon" onClick={() => changeDate(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="date-label">{dateLabel}</span>
            <button className="btn-icon" onClick={() => changeDate(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            {!isToday && (
              <button className="btn-secondary btn-sm" onClick={() => setSelectedDate(todayStr)}>回到今天</button>
            )}
          </div>

          <div className="timeline-hours">
            {HOURS.map(h => {
              const hourTasks = dayTasks.filter(t => {
                if (t.reminderAt) {
                  const remH = new Date(t.reminderAt).getHours();
                  return remH === h.id;
                }
                return false;
              });

              return (
                <div key={h.id} className="timeline-row" data-hour={h.id}>
                  <div className="timeline-time">{h.label}</div>
                  <div className="timeline-slot">
                    <div className="timeline-line" />
                    {hourTasks.map(t => (
                      <div
                        key={t.id}
                        className="timeline-task-chip"
                        style={{ borderLeftColor: getTypeColor(t.typeId) }}
                        onClick={() => onOpenDetail?.(t)}
                      >
                        <span className="chip-title">{t.title}</span>
                        <span className="chip-type" style={{ color: getTypeColor(t.typeId) }}>
                          {getTypeName(t.typeId)}
                        </span>
                      </div>
                    ))}
                    <button
                      className="timeline-add-btn"
                      onClick={() => {
                        setQuickAddOpen({ date: selectedDate, hour: h.id, hourLabel: h.label });
                        setQuickTitle("");
                        setQuickTypeId(null);
                      }}
                      title={`${h.label} 添加日程`}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {quickAddOpen && (
        <div className="modal-overlay" onClick={() => setQuickAddOpen(null)}>
          <div className="modal quick-add-modal" onClick={e => e.stopPropagation()}>
            <h3>添加日程</h3>
            <p className="modal-subtitle">{quickAddOpen.date} · {quickAddOpen.hourLabel}</p>
            <input
              autoFocus
              placeholder="日程标题"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            />
            <div className="form-field">
              <label className="form-label">任务类型</label>
              <select className="form-select" value={quickTypeId || ""} onChange={e => setQuickTypeId(e.target.value || null)}>
                <option value="">无类型</option>
                {taskTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setQuickAddOpen(null)}>取消</button>
              <button className="btn-primary" onClick={handleQuickAdd}>添加</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
