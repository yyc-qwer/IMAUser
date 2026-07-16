import { useState } from "react";

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function MonthView({
  tasks, taskTypes, getTypeName, getTypeColor,
  onOpenDetail, onQuickAdd,
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [quickAddOpen, setQuickAddOpen] = useState(null); // { date }
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTypeId, setQuickTypeId] = useState(null);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayStr = now.toISOString().slice(0, 10);

  // 构建日历网格
  const cells = [];
  // 前置空白天
  for (let i = 0; i < firstDay; i++) {
    cells.push({ type: "empty", key: `empty-${i}` });
  }
  // 实际日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayTasks = tasks.filter(t => {
      if (!t.startDate && !t.endDate) return false;
      // 单日任务：只有 startDate 或 startDate === endDate
      if (!t.endDate || t.startDate === t.endDate) {
        return t.startDate === dateStr;
      }
      // 跨天任务：dateStr 在 [startDate, endDate] 范围内
      if (t.startDate > dateStr) return false;
      if (t.endDate < dateStr) return false;
      return true;
    });
    cells.push({
      type: "day",
      key: dateStr,
      date: dateStr,
      day: d,
      isToday: dateStr === todayStr,
      isWeekend: new Date(year, month, d).getDay() % 6 === 0,
      tasks: dayTasks.slice(0, 3), // 最多显示3个
      more: Math.max(0, dayTasks.length - 3),
    });
  }

  const handleQuickAdd = () => {
    if (!quickTitle.trim() || !quickAddOpen) return;
    onQuickAdd({ title: quickTitle.trim(), date: quickAddOpen.date, typeId: quickTypeId });
    setQuickTitle("");
    setQuickTypeId(null);
    setQuickAddOpen(null);
  };

  return (
    <>
      <header className="main-header">
        <div className="date-navigator">
          <button className="btn-icon" onClick={() => changeMonth(-1)} title="上月">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="date-label">{year}年 {MONTH_NAMES[month]}</span>
          <button className="btn-icon" onClick={() => changeMonth(1)} title="下月">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button className="btn-secondary btn-sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>
            回到本月
          </button>
        </div>
      </header>

      <div className="month-calendar">
        <div className="month-weekdays">
          {WEEKDAYS.map(d => (
            <div key={d} className="month-weekday">{d}</div>
          ))}
        </div>
        <div className="month-grid">
          {cells.map(cell => {
            if (cell.type === "empty") {
              return <div key={cell.key} className="month-cell empty-cell" />;
            }
            return (
              <div
                key={cell.key}
                className={`month-cell${cell.isToday ? ' today' : ''}${cell.isWeekend ? ' weekend' : ''}`}
              >
                <div className="month-cell-header">
                  <span className="month-day-num">{cell.day}</span>
                  <button
                    className="month-cell-add"
                    onClick={(e) => { e.stopPropagation(); setQuickAddOpen({ date: cell.date }); setQuickTitle(""); setQuickTypeId(null); }}
                    title="添加日程"
                  >+</button>
                </div>
                <div className="month-cell-tasks">
                  {cell.tasks.map(t => (
                    <div
                      key={t.id}
                      className="month-task-chip"
                      style={{ borderLeftColor: getTypeColor(t.typeId) }}
                      onClick={() => onOpenDetail(t)}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {cell.more > 0 && (
                    <div className="month-task-more">+{cell.more} 更多</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 快速添加弹窗 */}
      {quickAddOpen && (
        <div className="modal-overlay" onClick={() => setQuickAddOpen(null)}>
          <div className="modal quick-add-modal" onClick={e => e.stopPropagation()}>
            <h3>添加日程</h3>
            <p className="modal-subtitle">{quickAddOpen.date}</p>
            <input
              autoFocus
              placeholder="日程标题"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            />
            <div className="form-field">
              <label className="form-label">任务类型</label>
              <select
                className="form-select"
                value={quickTypeId || ""}
                onChange={e => setQuickTypeId(e.target.value || null)}
              >
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
