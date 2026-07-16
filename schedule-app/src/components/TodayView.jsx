import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PERIOD_TIME } from "../utils/courseUtils";
import { fmtDate } from "../utils/dateUtils";

/**
 * TodayView - 今日概览组件
 * 作为应用默认首页，展示今日课程、待办事项和空闲时段建议
 */
export default function TodayView({
  tasks,
  taskTypes,
  getTypeName,
  getTypeColor,
  onOpenDetail,
  onOpenNew,
  addTask,
}) {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const hour = now.getHours();
  const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weekday = weekdayNames[now.getDay()];
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // 问候语
  const getGreeting = () => {
    if (hour < 12) return "早上好";
    if (hour < 18) return "下午好";
    return "晚上好";
  };

  // ===== 过滤今日任务 =====
  const todayTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 标准化日期到 YYYY-MM-DD（处理时区偏移问题）
      const toLocal = (d) => {
        if (!d) return null;
        const s = String(d);
        // 如果已经是 YYYY-MM-DD 格式直接返回
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // 如果包含 T，用本地时间
        if (s.includes('T')) {
          try {
            const local = new Date(s).toLocaleDateString('sv-SE'); // sv-SE gives YYYY-MM-DD
            return local;
          } catch { return null; }
        }
        return s;
      };
      const start = toLocal(t.startDate);
      const end = toLocal(t.endDate);
      if (!start && !end) return false;
      // 单日任务
      if (start === end || !end) return start === todayStr;
      // 范围任务：今天在 [start, end] 之间
      if (start > todayStr) return false;
      if (end < todayStr) return false;
      return true;
    });
  }, [tasks, todayStr]);

  // ===== 今日课程 =====
  const todayCourses = useMemo(() => {
    return todayTasks
      .filter((t) => t.source === "course")
      .map((t) => ({
        ...t,
        // 解析课程时间
        timeRange: parseCourseTime(t),
        // 解析地点
        location: t.courseLocation || parseLocation(t.notes || ""),
      }))
      .sort((a, b) => {
        // 按课程开始时间排序
        const aStart = timeToMinutes(a.timeRange?.start);
        const bStart = timeToMinutes(b.timeRange?.start);
        return (aStart ?? 999) - (bStart ?? 999);
      });
  }, [todayTasks]);

  // ===== 今日待办（非课程、未完成） =====
  const todayTodos = useMemo(() => {
    return todayTasks
      .filter((t) => t.source !== "course" && !t.completed)
      .sort((a, b) => {
        // 按 endDate 排序，截止日期近的排前面
        const aEnd = a.endDate || "9999-12-31";
        const bEnd = b.endDate || "9999-12-31";
        return aEnd.localeCompare(bEnd);
      });
  }, [todayTasks]);

  // ===== 空闲时段建议 =====
  const freeSlots = useMemo(() => {
    if (todayCourses.length === 0) return [];

    // 构建已占用时间段列表
    const occupied = todayCourses
      .filter((c) => c.timeRange)
      .map((c) => ({
        start: timeToMinutes(c.timeRange.start),
        end: timeToMinutes(c.timeRange.end),
      }))
      .sort((a, b) => a.start - b.start);

    // 合并重叠区间
    const merged = [];
    for (const slot of occupied) {
      if (merged.length === 0 || slot.start > merged[merged.length - 1].end) {
        merged.push({ ...slot });
      } else {
        merged[merged.length - 1].end = Math.max(
          merged[merged.length - 1].end,
          slot.end
        );
      }
    }

    // 计算空闲时段（从当前时间或第一个课程之前开始，到 22:00 结束）
    const freeSlotsList = [];
    const dayStart = Math.max(timeToMinutes(minutesToStr(hour, 0)), 480); // 08:00 或当前时间
    const dayEnd = 1320; // 22:00
    let cursor = 480; // 08:00

    for (const slot of merged) {
      if (cursor < slot.start && slot.start > dayStart) {
        // cursor 到 slot.start 之间是空闲的
        const freeStart = Math.max(cursor, dayStart);
        if (freeStart < slot.start && slot.start - freeStart >= 30) {
          freeSlotsList.push({
            start: freeStart,
            end: slot.start,
            suggestion: getSuggestion(freeStart, slot.start, todayTodos),
          });
        }
      }
      cursor = Math.max(cursor, slot.end);
    }

    // 最后一段空闲时间
    if (cursor < dayEnd && dayEnd - cursor >= 30) {
      const freeStart = Math.max(cursor, dayStart);
      if (freeStart < dayEnd && dayEnd - freeStart >= 30) {
        freeSlotsList.push({
          start: freeStart,
          end: dayEnd,
          suggestion: getSuggestion(freeStart, dayEnd, todayTodos),
        });
      }
    }

    return freeSlotsList;
  }, [todayCourses, todayTodos, hour]);

  return (
    <div className="today-view">
      {/* ===== 1. 顶部问候栏 ===== */}
      <div className="today-greeting">
        <h2>
          {getGreeting()}，今天 {month}月{day}日 {weekday}
        </h2>
        <button className="btn-primary today-new-btn" onClick={onOpenNew}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建任务
        </button>
      </div>

      {/* ===== 2. 今日课程时间轴 ===== */}
      <section className="today-section">
        <h3 className="today-section-title">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          今日课程
          {todayCourses.length > 0 && (
            <span className="today-section-count">{todayCourses.length} 节</span>
          )}
        </h3>

        {todayCourses.length === 0 ? (
          <div className="today-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>今天没有课程</span>
            <button className="btn-secondary" style={{ marginTop: 12, fontSize: 13 }} onClick={() => navigate("/course-import")}>
              导入课表
            </button>
          </div>
        ) : (
          <div className="today-course-list">
            {todayCourses.map((course, idx) => (
              <div
                key={course.id}
                className="today-course-item"
                onClick={() => onOpenDetail(course)}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="today-course-time">
                  {course.timeRange ? (
                    <>
                      <span className="today-course-start">
                        {course.timeRange.start}
                      </span>
                      <span className="today-course-sep">-</span>
                      <span className="today-course-end">
                        {course.timeRange.end}
                      </span>
                    </>
                  ) : (
                    <span className="today-course-start">时间待定</span>
                  )}
                </div>
                <div className="today-course-info">
                  <span className="today-course-name">{course.title}</span>
                  {course.location && (
                    <span className="today-course-location">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {course.location}
                    </span>
                  )}
                </div>
                {/* 时间轴连接线指示器 */}
                <div className="today-course-dot" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== 3. 今日待办 ===== */}
      <section className="today-section">
        <h3 className="today-section-title">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          今日待办
          {todayTodos.length > 0 && (
            <span className="today-section-count">
              {todayTodos.length} 项
            </span>
          )}
        </h3>

        {todayTodos.length === 0 ? (
          <div className="today-empty">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text3)"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span>今天没有待办事项，享受轻松时光</span>
          </div>
        ) : (
          <div className="today-todo-list">
            {todayTodos.map((todo, idx) => {
              const color = getTypeColor(todo.typeId);
              const typeName = getTypeName(todo.typeId);
              const isOverdue = todo.endDate && todo.endDate < todayStr;

              return (
                <div
                  key={todo.id}
                  className="today-todo-card"
                  onClick={() => onOpenDetail(todo)}
                  style={{
                    borderLeftColor: color,
                    animationDelay: `${idx * 60}ms`,
                  }}
                >
                  <div className="today-todo-header">
                    <span className="today-todo-title">{todo.title}</span>
                    {typeName && (
                      <span
                        className="today-todo-type"
                        style={{ background: color + "1a", color }}
                      >
                        {typeName}
                      </span>
                    )}
                  </div>
                  <div className="today-todo-meta">
                    {todo.endDate && (
                      <span
                        className={`today-todo-date ${
                          isOverdue ? "today-todo-overdue" : ""
                        }`}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {isOverdue ? "已逾期 · " : "截止 "}
                        {fmtDate(todo.endDate)}
                      </span>
                    )}
                    {todo.priority && (
                      <span
                        className={`today-todo-priority priority-${todo.priority}`}
                      >
                        {todo.priority === "high"
                          ? "高优先级"
                          : todo.priority === "medium"
                          ? "中优先级"
                          : "低优先级"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 4. 空闲时段建议 ===== */}
      {freeSlots.length > 0 && (
        <section className="today-section">
          <h3 className="today-section-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            空闲时段
          </h3>
          <div className="today-free-list">
            {freeSlots.map((slot, idx) => (
              <div
                key={idx}
                className="today-free-slot"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="today-free-time">
                  {minutesToStr(
                    Math.floor(slot.start / 60),
                    slot.start % 60
                  )}
                  -
                  {minutesToStr(
                    Math.floor(slot.end / 60),
                    slot.end % 60
                  )}
                </div>
                <div className="today-free-divider" />
                <div className="today-free-suggestion">{slot.suggestion}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ===== 工具函数 =====

/**
 * 解析课程时间
 * 优先从 notes 中匹配 "第X节" 对应的 PERIOD_TIME
 * 其次尝试从 notes 中匹配 "HH:MM-HH:MM" 格式
 * 最后尝试从 reminderAt 提取
 */
function parseCourseTime(task) {
  const notes = task.notes || '';

  // 从 notes 中匹配 "第X节"（如 "张老师 | A101 | 第1节 | 08:00-08:45"）
  const periodMatch = notes.match(/第(\d+)节/);
  if (periodMatch) {
    const period = '第' + periodMatch[1] + '节';
    if (PERIOD_TIME[period]) {
      return { start: PERIOD_TIME[period].start, end: PERIOD_TIME[period].end };
    }
  }

  // 从 notes 中匹配 "HH:MM-HH:MM" 格式
  const timeMatch = notes.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
  if (timeMatch) {
    return { start: timeMatch[1], end: timeMatch[2] };
  }

  // 尝试从 reminderAt 提取时间
  if (task.reminderAt) {
    try {
      const d = new Date(task.reminderAt);
      if (!isNaN(d.getTime())) {
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        // 假设课程时长 45 分钟
        const endH = String(
          Math.min(d.getHours() + 1, 23)
        ).padStart(2, "0");
        const endM = String(
          (d.getMinutes() + 45) % 60
        ).padStart(2, "0");
        return { start: `${h}:${m}`, end: `${endH}:${endM}` };
      }
    } catch {}
  }

  return null;
}

/**
 * 从 notes 中解析地点
 * 格式示例："张老师 教学楼A301"
 */
function parseLocation(notes) {
  if (!notes) return "";
  // 尝试从 "|" 分隔的格式中提取地点（第二段）
  const parts = notes.split('|').map(s => s.trim());
  if (parts.length >= 2) return parts[1];
  // 尝试匹配常见地点格式
  const match = notes.match(
    /(?:教学楼|教楼|实验楼|图书馆|机房|体育馆|操场|报告厅|教室|A\d|B\d|C\d|D\d|综合楼|文科楼|理科楼|工字楼)(?:\d*)[\w]*/
  );
  if (match) return match[0];
  return "";
}

/**
 * 将时间字符串 "HH:MM" 转换为分钟数
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * 将小时和分钟转换为 "HH:MM" 字符串
 */
function minutesToStr(h, m) {
  return `${String(h).padStart(2, "0")}:${String(Math.round(m)).padStart(2, "0")}`;
}

/**
 * 根据空闲时段长度和待办事项生成建议文案
 */
function getSuggestion(startMin, endMin, todos) {
  const duration = endMin - startMin;

  // 如果有待办，建议去完成
  if (todos.length > 0) {
    const todo = todos[0];
    const title =
      todo.title.length > 12
        ? todo.title.slice(0, 12) + "..."
        : todo.title;
    return `建议完成「${title}」`;
  }

  // 根据时长给不同建议
  if (duration >= 120) return "大段空闲，适合深度学习或项目推进";
  if (duration >= 60) return "适合集中处理一项任务";
  return "可以休息一下或回顾笔记";
}
