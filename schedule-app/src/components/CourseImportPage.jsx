import { useState, useEffect } from "react";
import { parseWeeks, getCourseDate, coursesToTasks, PERIOD_TIME } from "../utils/courseUtils";

export default function CourseImportPage({ addTask, deleteTask, tasks, refresh, toast }) {
  const [courses, setCourses] = useState([]);
  const [semesterStart, setSemesterStart] = useState("2025-02-24");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const existingCourseCount = (tasks || []).filter(t => t.source === 'course').length;

  useEffect(() => {
    let data = null;

    // 1. 检查 URL hash（支持两种格式：#/import= 和 #import=）
    const hash = window.location.hash;
    const importMatch = hash.match(/#\/?import=(.+)/);
    if (importMatch) {
      try {
        data = JSON.parse(decodeURIComponent(importMatch[1]));
      } catch {
        data = null;
      }
    }

    // 2. 检查 localStorage（网页版存储）
    if (!data) {
      try {
        const stored = localStorage.getItem("imau_import_queue");
        if (stored) {
          data = JSON.parse(stored);
        }
      } catch {
        data = null;
      }
    }

    // 3. 检查 URL 参数（兼容 iframe/postMessage 方式）
    if (!data) {
      try {
        const params = new URLSearchParams(window.location.search);
        const paramData = params.get("import");
        if (paramData) {
          data = JSON.parse(decodeURIComponent(paramData));
        }
      } catch {
        data = null;
      }
    }

    if (Array.isArray(data) && data.length > 0) {
      // 过滤出课程数据（content.js 会混合作业数据）
      const courseData = data.filter(d => d.weekday || d.courseName);
      setCourses(courseData.length > 0 ? courseData : data);
    } else {
      setCourses([]);
    }
  }, []);

  const handleImport = async () => {
    if (!semesterStart) {
      toast("请选择学期第一天", "error");
      return;
    }
    if (courses.length === 0) {
      toast("没有可导入的课程", "error");
      return;
    }

    setImporting(true);
    setImportedCount(0);

    try {
      const tasks = coursesToTasks(courses, semesterStart);
      // 按 startDate 去重（同一门课同一周只导入一次）
      const seen = new Set();
      const deduped = tasks.filter(t => {
        const key = `${t.title}_${t.startDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let count = 0;
      let errors = 0;
      for (const task of deduped) {
        try {
          await addTask(task);
          count++;
        } catch (e) {
          console.error('导入任务失败:', task.title, e);
          errors++;
        }
      }
      setImportedCount(count);
      if (errors > 0) {
        toast(`导入完成：${count} 条成功，${errors} 条失败`, "error");
      } else {
        toast(`成功导入 ${count} 条课程任务`, "success");
      }
      localStorage.removeItem("imau_import_queue");
      if (refresh) refresh();
    } catch (e) {
      toast("导入失败：" + (e.message || "未知错误"), "error");
    } finally {
      setImporting(false);
    }
  };

  const weekdayOrder = { "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6, "周日": 7 };

  const sortedCourses = [...courses].sort((a, b) => {
    const wa = weekdayOrder[a.weekday] || 0;
    const wb = weekdayOrder[b.weekday] || 0;
    if (wa !== wb) return wa - wb;
    const pa = parseInt((a.period || "").replace(/[^0-9]/g, "")) || 0;
    const pb = parseInt((b.period || "").replace(/[^0-9]/g, "")) || 0;
    return pa - pb;
  });

  return (
    <>
      <header className="main-header">
        <h2>课表导入</h2>
      </header>

      <div className="import-area" style={{ gridTemplateColumns: "1fr", maxWidth: 900 }}>
        <div className="import-card">
          <h3>学期设置</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <label style={{ color: "var(--text2)", fontSize: 14 }}>学期第一天</label>
            <input
              type="date"
              value={semesterStart}
              onChange={(e) => setSemesterStart(e.target.value)}
              style={{ width: "auto" }}
            />
            <span style={{ color: "var(--text3)", fontSize: 13 }}>
              将根据此日期计算每周课程的具体日期
            </span>
          </div>
        </div>

        <div className="import-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <h3>课程预览</h3>
            <span style={{ color: "var(--text2)", fontSize: 13 }}>
              共 {courses.length} 门课程
            </span>
          </div>

          {courses.length === 0 && !pasteMode ? (
            <div className="empty" style={{ padding: "40px 20px" }}>
              <div style={{ marginBottom: 16 }}>
                未检测到课表数据，请先使用浏览器插件抓取课表，
                <br />然后点击插件的「推送至日程看板」按钮。
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={() => setPasteMode(true)}>
                  手动粘贴 JSON
                </button>
                <button className="btn-secondary" onClick={() => {
                  // 从 localStorage 尝试读取（兼容手动存入的情况）
                  try {
                    const stored = localStorage.getItem("imau_import_queue");
                    if (stored) {
                      const data = JSON.parse(stored);
                      const courseData = data.filter(d => d.weekday || d.courseName);
                      if (courseData.length > 0) {
                        setCourses(courseData.length > 0 ? courseData : data);
                        toast(`从本地缓存读取到 ${courseData.length} 门课程`, "success");
                        return;
                      }
                    }
                  } catch {}
                  toast("本地缓存也没有数据", "error");
                }}>
                  重新读取本地缓存
                </button>
              </div>
            </div>
          ) : courses.length === 0 && pasteMode ? (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 8 }}>
                在浏览器插件中点击「复制 JSON」，然后粘贴到下面：
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder='粘贴插件抓取的 JSON 数据...\n格式：[{"weekday":"周一","period":"第1节","courseName":"高等数学",...}]'
                style={{
                  width: "100%", minHeight: 200, padding: 12,
                  border: "1px solid var(--border)", borderRadius: "var(--radius)",
                  background: "var(--surface)", color: "var(--text)",
                  fontSize: 13, fontFamily: "monospace", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn-primary" onClick={() => {
                  try {
                    const data = JSON.parse(pasteText);
                    const courseData = Array.isArray(data)
                      ? data.filter(d => d.weekday || d.courseName)
                      : [];
                    if (courseData.length > 0) {
                      setCourses(courseData);
                      setPasteMode(false);
                      toast(`解析到 ${courseData.length} 门课程`, "success");
                    } else {
                      toast("未找到课程数据，请检查 JSON 格式", "error");
                    }
                  } catch {
                    toast("JSON 格式错误，请检查", "error");
                  }
                }}>
                  解析并预览
                </button>
                <button className="btn-secondary" onClick={() => setPasteMode(false)}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="schedule-table-wrapper" style={{ marginTop: 8 }}>
              <div className="schedule-table-scroll">
                <table className="schedule-table" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th className="day-header">课程名</th>
                      <th className="day-header">星期</th>
                      <th className="day-header">节次</th>
                      <th className="day-header">周次</th>
                      <th className="day-header">地点</th>
                      <th className="day-header">教师</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCourses.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "10px 12px", fontSize: 14, color: "var(--text)" }}>
                          {c.courseName}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                          {c.weekday}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                          {c.period}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                          {c.classTime}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                          {c.location || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text2)", textAlign: "center" }}>
                          {c.teacher || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {courses.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  className="btn-primary"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? `导入中... (${importedCount})` : "导入课程"}
                </button>
                {importedCount > 0 && !importing && (
                  <span style={{ color: "var(--success)", fontSize: 14 }}>
                    已成功导入 {importedCount} 条任务
                  </span>
                )}
              </div>
              {/* 清空已有课程 */}
              {existingCourseCount > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "var(--text2)", fontSize: 13 }}>
                    已有 {existingCourseCount} 条课程任务
                  </span>
                  <button
                    className="btn-danger"
                    style={{ fontSize: 13, padding: "6px 14px" }}
                    onClick={async () => {
                      if (!confirm(`确定要删除全部 ${existingCourseCount} 条课程任务吗？`)) return;
                      try {
                        const courseTasks = tasks.filter(t => t.source === 'course');
                        for (const t of courseTasks) {
                          await deleteTask(t.id);
                        }
                        toast(`已删除 ${courseTasks.length} 条课程任务`, "success");
                        if (refresh) refresh();
                      } catch (e) {
                        toast("删除失败：" + e.message, "error");
                      }
                    }}
                  >
                    清空所有课程
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
