import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "imau_schedule_data";
const SEMESTER_KEY = "imau_semester_start";

const DEFAULT_PERIODS = [
  { id: 0, name: "第1节", start: "08:00", end: "08:45" },
  { id: 1, name: "第2节", start: "08:55", end: "09:40" },
  { id: 2, name: "第3节", start: "10:00", end: "10:45" },
  { id: 3, name: "第4节", start: "10:55", end: "11:40" },
  { id: 4, name: "第5节", start: "14:30", end: "15:15" },
];

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const COURSE_COLORS = [
  "#3d7a5c", "#d4855e", "#5b9bd5", "#c4943a",
  "#8b6db5", "#4ba89a", "#d9748c", "#6b8caf",
  "#b07b3e", "#5e7a3d", "#7a5c6b", "#3d6b7a",
];

function getColorForCourse(name) {
  if (!name) return COURSE_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

// 星期字符串 → dayIndex (0-6)
function parseWeekday(str) {
  const map = { "周一": 0, "周二": 1, "周三": 2, "周四": 3, "周五": 4, "周六": 5, "周日": 6 };
  return map[str?.trim()] ?? -1;
}

// 中文数字 → 阿拉伯数字
function chineseNumToDigit(ch) {
  const map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  return map[ch] ?? null;
}

// "第1,2节" → [0, 1]  /  "第3节" → [2]  /  "第1-2节" → [0, 1]  /  "第一大节" → [0, 1]
function parsePeriods(str) {
  if (!str) return [];

  // 匹配 "第X大节"（中文数字或阿拉伯数字），每大节 = 2 小节
  const bigMatch = str.match(/第([一二三四五六七八九十\d]+)大节/);
  if (bigMatch) {
    const num = chineseNumToDigit(bigMatch[1]) ?? parseInt(bigMatch[1], 10);
    if (!isNaN(num) && num >= 1) {
      const start = (num - 1) * 2; // 第一大节→节0-1, 第二大节→节2-3, ...
      return [start, start + 1];
    }
  }

  // 匹配 "第N,N节" 或 "第N-N节"
  const m = str.match(/第([\d,\-]+)节/);
  if (!m) return [];
  const parts = m[1].split(",");
  const result = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [s, e] = part.split("-").map(Number);
      for (let i = s; i <= e; i++) result.push(i - 1);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) result.push(n - 1);
    }
  }
  return result;
}

// 解析 CSV 一行（处理双引号包裹的字段）
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(current); current = ""; }
      else current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

function loadSchedule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        periods: data.periods?.length ? data.periods : DEFAULT_PERIODS,
        courses: data.courses || {},
      };
    }
  } catch (e) { /* ignore */ }
  return { periods: DEFAULT_PERIODS, courses: {} };
}

function saveSchedule(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function ScheduleView({ tasks = [], taskTypes = [], addTask, addTaskType, refresh, getTypeName, getTypeColor }) {
  const [schedule, setSchedule] = useState(loadSchedule);
  const [showSettings, setShowSettings] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { day, period }
  const [importStatus, setImportStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null); // { type, msg }
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef(null);

  // 学期起始日期，持久化到 localStorage
  const [semesterStart, setSemesterStart] = useState(() => {
    try { return localStorage.getItem(SEMESTER_KEY) || ""; }
    catch { return ""; }
  });

  const saveSemester = (val) => {
    setSemesterStart(val);
    localStorage.setItem(SEMESTER_KEY, val);
  };

  useEffect(() => { saveSchedule(schedule); }, [schedule]);

  // ===== 课表同步到任务列表 =====
  const syncToTasks = async () => {
    if (!addTask) return;

    const courses = Object.entries(schedule.courses);
    if (courses.length === 0) {
      setSyncStatus({ type: "error", msg: "课表为空，请先导入或添加课程" });
      return;
    }

    if (!semesterStart) {
      setSyncStatus({ type: "error", msg: "请先在上方设置学期起始日期" });
      return;
    }

    setSyncing(true);
    setSyncStatus(null);

    try {
      // 确保有"课程"分类
      let courseType = taskTypes.find(t => t.name === "课程");
      if (!courseType && addTaskType) {
        await addTaskType({ name: "课程", color: "#3d7a5c" });
      }
      // 重新获取类型（addTaskType 后需要 refresh 才能拿到，这里用本地缓存）
      courseType = taskTypes.find(t => t.name === "课程");

      const semesterDate = new Date(semesterStart);
      let created = 0;
      let skipped = 0;

      for (const [key, course] of courses) {
        if (!course?.name) continue;

        // 检查去重：同名 + source="schedule" 且未完成的任务
        const exists = tasks.some(t =>
          t.title === course.name && t.source === "schedule" && !t.completed
        );
        if (exists) { skipped++; continue; }

        const [dayStr, periodStr] = key.split("-");
        const dayIndex = parseInt(dayStr, 10); // 0=周一, 6=周日

        // 计算日期
        let startDate = "", endDate = "";
        let weekStart = 1, weekEnd = 18;
        if (course.weekRange) {
          const m = course.weekRange.match(/(\d+)\s*[-~至]\s*(\d+)/);
          if (m) { weekStart = parseInt(m[1]); weekEnd = parseInt(m[2]); }
          else {
            const single = parseInt(course.weekRange);
            if (!isNaN(single)) { weekStart = weekEnd = single; }
          }
        }

        const calcDate = (weekNum) => {
          const d = new Date(semesterDate);
          d.setDate(d.getDate() + (weekNum - 1) * 7 + dayIndex);
          return d.toISOString().slice(0, 10);
        };

        startDate = calcDate(weekStart);
        endDate = calcDate(weekEnd);

        // 收集备注
        const notes = [
          course.location && `地点: ${course.location}`,
          course.teacher && `教师: ${course.teacher}`,
          course.weekRange && `周次: ${course.weekRange}`,
          course.classType && `类型: ${course.classType}`,
        ].filter(Boolean).join("\n");

        const taskData = {
          title: course.name,
          typeId: courseType?.id || null,
          startDate,
          endDate,
          notes,
          priority: "medium",
          source: "schedule",
          repeatRule: "weekly",
        };

        const resultId = await addTask(taskData);
        if (resultId) created++;
      }

      if (refresh) await refresh();
      setSyncStatus({
        type: "success",
        msg: `同步完成！新建 ${created} 个任务，跳过 ${skipped} 个已有任务`,
      });
    } catch (err) {
      setSyncStatus({ type: "error", msg: `同步失败: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  };

  // ===== 设置：修改节次时间 =====
  const updatePeriod = (id, field, value) => {
    setSchedule(prev => ({
      ...prev,
      periods: prev.periods.map(p => p.id === id ? { ...p, [field]: value } : p),
    }));
  };

  const addPeriod = () => {
    setSchedule(prev => {
      const maxId = prev.periods.reduce((m, p) => Math.max(m, p.id), -1);
      const newId = maxId + 1;
      return {
        ...prev,
        periods: [...prev.periods, {
          id: newId,
          name: `第${newId + 1}节`,
          start: "16:00",
          end: "16:45",
        }],
      };
    });
  };

  const removePeriod = (id) => {
    setSchedule(prev => {
      const newPeriods = prev.periods.filter(p => p.id !== id);
      const newCourses = { ...prev.courses };
      for (const key of Object.keys(newCourses)) {
        const [, pid] = key.split("-").map(Number);
        if (pid === id) delete newCourses[key];
      }
      return { periods: newPeriods, courses: newCourses };
    });
  };

  // ===== 手动编辑课程 =====
  const setCourse = (day, period, courseData) => {
    setSchedule(prev => {
      const key = `${day}-${period}`;
      const newCourses = { ...prev.courses };
      if (courseData === null) {
        delete newCourses[key];
      } else {
        newCourses[key] = courseData;
      }
      return { ...prev, courses: newCourses };
    });
  };

  // ===== CSV 导入 =====
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result.replace(/^\uFEFF/, "");
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setImportStatus({ type: "error", msg: "CSV 文件为空或格式不对" });
          return;
        }

        // 检查表头
        const headers = parseCSVLine(lines[0]);
        const idx = {
          weekday: headers.findIndex(h => h.includes("星期")),
          period: headers.findIndex(h => h.includes("节次")),
          courseName: headers.findIndex(h => h.includes("课程名")),
          location: headers.findIndex(h => h.includes("地点")),
          teacher: headers.findIndex(h => h.includes("教师")),
          weekRange: headers.findIndex(h => h.includes("周次")),
          classType: headers.findIndex(h => h.includes("学时") || h.includes("类型")),
        };

        if (idx.weekday < 0 || idx.period < 0 || idx.courseName < 0) {
          setImportStatus({ type: "error", msg: "CSV 表头不匹配，需要包含：星期、节次、课程名" });
          return;
        }

        // 解析数据行，找出需要的最大节次数
        const newCourses = {};
        let maxPeriod = -1;

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const weekday = parseWeekday(cols[idx.weekday]);
          const periodStr = cols[idx.period] || "";
          const periodIndices = parsePeriods(periodStr);
          const courseName = cols[idx.courseName] || "";
          const location = idx.location >= 0 ? (cols[idx.location] || "") : "";
          const teacher = idx.teacher >= 0 ? (cols[idx.teacher] || "") : "";
          const weekRange = idx.weekRange >= 0 ? (cols[idx.weekRange] || "") : "";
          const classType = idx.classType >= 0 ? (cols[idx.classType] || "") : "";

          if (weekday < 0 || periodIndices.length === 0 || !courseName) continue;

          for (const pid of periodIndices) {
            if (pid > maxPeriod) maxPeriod = pid;
            const key = `${weekday}-${pid}`;
            newCourses[key] = { name: courseName, location, teacher, weekRange, classType };
          }
        }

        // 如果 CSV 中有更多节次，自动扩展
        setSchedule(prev => {
          let periods = [...prev.periods];
          while (periods.length <= maxPeriod) {
            const newId = periods.length;
            periods.push({
              id: newId,
              name: `第${newId + 1}节`,
              start: "",
              end: "",
            });
          }
          // 合并：保留已有手填课程，CSV 数据覆盖同位置的
          const merged = { ...prev.courses, ...newCourses };
          return { periods, courses: merged };
        });

        const count = Object.keys(newCourses).length;
        setImportStatus({ type: "success", msg: `成功导入 ${count} 条课程数据！` });
      } catch (err) {
        setImportStatus({ type: "error", msg: "解析失败: " + err.message });
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = ""; // 允许重复导入同一文件
  };

  // ===== 清空课表 =====
  const clearAll = () => {
    if (!confirm("确定要清空所有课程吗？")) return;
    setSchedule(prev => ({ ...prev, courses: {} }));
    setImportStatus({ type: "success", msg: "已清空所有课程" });
  };

  // ===== 渲染 =====
  const numDays = 7;
  const numPeriods = schedule.periods.length;

  return (
    <>
      <header className="main-header">
        <h2>您的课表</h2>
        <div className="schedule-toolbar">
          <button className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            导入 CSV
          </button>
          <button className="btn-primary btn-sm" onClick={syncToTasks} disabled={syncing}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            {syncing ? "同步中..." : "同步到任务"}
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowSettings(s => !s)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg>
            {showSettings ? "收起设置" : "课节设置"}
          </button>
          <button className="btn-secondary btn-sm danger-btn" onClick={clearAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            清空
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleCSVImport} />
        </div>
      </header>

      {importStatus && (
        <div className={`schedule-import-status ${importStatus.type}`} onClick={() => setImportStatus(null)}>
          {importStatus.msg}
        </div>
      )}

      {syncStatus && (
        <div className={`schedule-import-status ${syncStatus.type}`} onClick={() => setSyncStatus(null)}>
          {syncStatus.msg}
        </div>
      )}

      {showSettings && (
        <div className="schedule-settings-panel">
          <h3>学期设置</h3>
          <div className="semester-date-row">
            <label>学期起始日期（周一）：</label>
            <input
              type="date"
              value={semesterStart}
              onChange={e => saveSemester(e.target.value)}
              className="semester-date-input"
            />
            <span className="settings-hint">设置后，"同步到任务"会根据周次自动计算每天的上课日期</span>
          </div>

          <h3 style={{ marginTop: "20px" }}>课节时间设置</h3>
          <p className="settings-hint">点击每节课设置上课时间和下课时间，右侧课表会实时显示</p>
          <div className="settings-periods">
            {schedule.periods.map(p => (
              <div key={p.id} className="settings-period-row">
                <span className="period-label">{p.name}</span>
                <input type="time" value={p.start} onChange={e => updatePeriod(p.id, "start", e.target.value)} />
                <span className="period-dash">~</span>
                <input type="time" value={p.end} onChange={e => updatePeriod(p.id, "end", e.target.value)} />
                <input type="text" value={p.name} className="period-name-input" onChange={e => updatePeriod(p.id, "name", e.target.value)} />
                {schedule.periods.length > 1 && (
                  <button className="period-remove-btn" onClick={() => removePeriod(p.id)} title="删除此节">✕</button>
                )}
              </div>
            ))}
          </div>
          <button className="btn-secondary btn-sm" onClick={addPeriod}>+ 添加课节</button>
        </div>
      )}

      <div className="schedule-table-wrapper">
        <div className="schedule-table-scroll">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="corner-cell"></th>
                {DAY_NAMES.slice(0, numDays).map(day => (
                  <th key={day} className="day-header">{day}</th>
                ))}
                <th className="time-axis-header">时间</th>
              </tr>
            </thead>
            <tbody>
              {schedule.periods.map((period, pi) => (
                <tr key={period.id}>
                  <td className="period-cell">
                    <span className="period-name">{period.name}</span>
                  </td>
                  {Array.from({ length: numDays }).map((_, di) => {
                    const key = `${di}-${pi}`;
                    const course = schedule.courses[key];
                    return (
                      <td
                        key={di}
                        className={`schedule-cell ${course ? "has-course" : "empty"}`}
                        style={course ? { "--course-color": getColorForCourse(course.name) } : undefined}
                        onClick={() => setEditingCell({ day: di, period: pi, course })}
                      >
                        {course ? (
                          <div className="course-card" style={{ borderLeftColor: getColorForCourse(course.name) }}>
                            <div className="course-name">{course.name}</div>
                            {course.location && <div className="course-location">{course.location}</div>}
                            {course.teacher && <div className="course-teacher">{course.teacher}</div>}
                            {course.weekRange && <div className="course-week">{course.weekRange}</div>}
                            {course.classType && <span className="course-type-tag">{course.classType}</span>}
                          </div>
                        ) : (
                          <div className="cell-empty-hint">+</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="time-axis-cell">
                    <div className="time-start">{period.start || "--:--"}</div>
                    <div className="time-sep">|</div>
                    <div className="time-end">{period.end || "--:--"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 课程编辑弹窗 */}
      {editingCell && (
        <CourseEditModal
          cell={editingCell}
          onSave={(data) => {
            if (data && data.name) {
              setCourse(editingCell.day, editingCell.period, data);
            } else {
              setCourse(editingCell.day, editingCell.period, null);
            }
            setEditingCell(null);
          }}
          onClose={() => setEditingCell(null)}
        />
      )}
    </>
  );
}

// ===== 课程编辑弹窗 =====
function CourseEditModal({ cell, onSave, onClose }) {
  const existing = cell.course || {};
  const [form, setForm] = useState({
    name: existing.name || "",
    location: existing.location || "",
    teacher: existing.teacher || "",
    weekRange: existing.weekRange || "",
    classType: existing.classType || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form.name.trim() ? form : null);
  };

  const handleDelete = () => {
    onSave(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal schedule-edit-modal" onClick={e => e.stopPropagation()}>
        <h3>{existing.name ? "编辑课程" : "添加课程"}</h3>
        <p className="modal-subtitle">{DAY_NAMES[cell.day]} · 第{cell.period + 1}节</p>
        <form onSubmit={handleSubmit}>
          <label>课程名称</label>
          <input
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="如：高等数学"
            autoFocus
          />
          <div className="form-row">
            <div>
              <label>上课地点</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="如：教101" />
            </div>
            <div>
              <label>任课教师</label>
              <input value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} placeholder="如：张老师" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label>上课周次</label>
              <input value={form.weekRange} onChange={e => setForm({ ...form, weekRange: e.target.value })} placeholder="如：1-16周" />
            </div>
            <div>
              <label>学时类型</label>
              <input value={form.classType} onChange={e => setForm({ ...form, classType: e.target.value })} placeholder="如：理论" />
            </div>
          </div>
          <div className="form-actions">
            {existing.name && <button type="button" className="btn-danger btn-sm" onClick={handleDelete}>删除课程</button>}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary">{existing.name ? "保存" : "添加"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
