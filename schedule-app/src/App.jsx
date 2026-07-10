import { useState, useEffect, useRef, useCallback } from "react";
import { useTasks, isNotificationEnabled, setNotificationEnabled, requestNotificationPermission, calcProcrastinationIndex, getDeadlinePressure, getStreakData } from "./hooks/useTasks";
import { useAuth } from "./hooks/useAuth";
import { formatCountdown, fmtDate } from "./utils/dateUtils";
import AIChat from "./components/AIChat";
import SplashScreen from "./components/SplashScreen";
import Skeleton from "./components/Skeleton";
import TaskDetailPage from "./components/TaskDetailPage";

const COLORS = ["#5b9bd5", "#d9544f", "#3d7a5c", "#d4a853", "#7c6fb0", "#d4668e", "#3ba3b8", "#d4855e"];

// ===== Pomodoro Timer Component =====
function PomodoroTimer() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work'); // work | shortBreak | longBreak
  const intervalRef = useRef(null);

  const modes = {
    work: { min: 25, label: '专注', color: '#d9544f' },
    shortBreak: { min: 5, label: '短休息', color: '#3d7a5c' },
    longBreak: { min: 15, label: '长休息', color: '#d4855e' },
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev === 0) {
            setMinutes(m => {
              if (m === 0) {
                setIsRunning(false);
                if (Notification.permission === 'granted') {
                  new Notification('番茄钟', { body: `${modes[mode].label}时间结束！` });
                }
                return modes[mode].min;
              }
              return m - 1;
            });
            return 59;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, mode]);

  const switchMode = (m) => {
    setIsRunning(false);
    setMode(m);
    setMinutes(modes[m].min);
    setSeconds(0);
  };

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(modes[mode].min);
    setSeconds(0);
  };

  const progress = ((modes[mode].min * 60 - (minutes * 60 + seconds)) / (modes[mode].min * 60)) * 100;

  return (
    <div className="pomodoro-card">
      <div className="pomodoro-modes">
        {Object.entries(modes).map(([k, v]) => (
          <button key={k} className={`pomodoro-mode-btn ${mode === k ? 'active' : ''}`}
            style={mode === k ? { color: v.color, borderColor: v.color } : {}}
            onClick={() => switchMode(k)}>{v.label}</button>
        ))}
      </div>
      <div className="pomodoro-time" style={{ color: modes[mode].color }}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="pomodoro-progress">
        <div className="pomodoro-progress-bar" style={{ width: `${progress}%`, background: modes[mode].color }} />
      </div>
      <div className="pomodoro-actions">
        <button className="btn-primary" onClick={toggleTimer}>
          {isRunning ? '暂停' : '开始'}
        </button>
        <button className="btn-secondary" onClick={resetTimer}>重置</button>
      </div>
    </div>
  );
}

// ===== Subtask List Component =====
function SubtaskList({ taskId, getSubtasks, addSubtask, toggleSubtask, deleteSubtask, onUpdate }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    const list = await getSubtasks(taskId);
    setSubtasks(list);
  }, [taskId, getSubtasks]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addSubtask(taskId, newTitle.trim());
    setNewTitle('');
    await load();
    onUpdate?.();
  };

  const handleToggle = async (id) => {
    await toggleSubtask(id);
    await load();
    onUpdate?.();
  };

  const handleDelete = async (id) => {
    await deleteSubtask(id);
    await load();
    onUpdate?.();
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const progress = subtasks.length ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className="subtask-list">
      {subtasks.length > 0 && (
        <div className="subtask-progress">
          <div className="subtask-progress-bar" style={{ width: `${progress}%` }} />
          <span className="subtask-progress-text">{completedCount}/{subtasks.length}</span>
        </div>
      )}
      {subtasks.map(st => (
        <div key={st.id} className={`subtask-item ${st.completed ? 'done' : ''}`}>
          <input type="checkbox" checked={st.completed} onChange={() => handleToggle(st.id)} />
          <span className="subtask-title">{st.title}</span>
          <button className="btn-icon-sm" onClick={() => handleDelete(st.id)} title="删除">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
      <div className="subtask-add">
        <input placeholder="添加子任务..." value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button className="btn-primary" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
}

function App() {
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();

  const {
    tasks, taskTypes, loading, activeTasks, completedTasks,
    addTask, updateTask, deleteTask, toggleComplete,
    addTaskType, deleteTaskType, refresh,
    getSubtasks, addSubtask, toggleSubtask, deleteSubtask,
    getWeeklyStats,
  } = useTasks();

  // Login form state
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [view, setView] = useState("tasks");
  const [showSplash, setShowSplash] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState(COLORS[0]);
  const [notifEnabled, setNotifEnabled] = useState(isNotificationEnabled());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [expandedTask, setExpandedTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [form, setForm] = useState({
    title: "", typeId: "", startDate: "", endDate: "", notes: "",
    priority: "medium", reminderAt: "", repeatRule: "none", source: "manual"
  });

  // 任务到期提醒检查
  useEffect(() => {
    if (!notifEnabled || Notification.permission !== 'granted') return;

    const checkDeadlines = () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const notifiedKey = 'ima_notified_tasks';
      let notified = {};
      try { notified = JSON.parse(localStorage.getItem(notifiedKey) || '{}'); } catch {}

      activeTasks.forEach(t => {
        if (!t.endDate || t.completed) return;
        const end = new Date(t.endDate + 'T23:59:59');
        if (end <= tomorrow && end > now) {
          const key = `${t.id}_${new Date().toISOString().slice(0, 10)}`;
          if (!notified[key]) {
            new Notification('任务即将到期', {
              body: `「${t.title}」将于 ${t.endDate} 截止，请尽快处理`,
              icon: '/favicon.ico'
            });
            notified[key] = true;
          }
        }
      });

      // 清理7天前的记录
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      Object.keys(notified).forEach(k => {
        const date = k.split('_')[1];
        if (date < weekAgo) delete notified[k];
      });
      localStorage.setItem(notifiedKey, JSON.stringify(notified));
    };

    checkDeadlines(); // 立即检查一次
    const id = setInterval(checkDeadlines, 5 * 60 * 1000); // 每5分钟
    return () => clearInterval(id);
  }, [notifEnabled, activeTasks]);

  const openNew = () => {
    setEditingTask(null);
    setForm({
      title: "", typeId: taskTypes[0]?.id || "", startDate: "", endDate: "", notes: "",
      priority: "medium", reminderAt: "", repeatRule: "none", source: "manual"
    });
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditingTask(t);
    setForm({
      title: t.title, typeId: t.typeId ?? "", startDate: t.startDate ?? "",
      endDate: t.endDate ?? "", notes: t.notes ?? "", priority: t.priority ?? "medium",
      reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : "",
      repeatRule: t.repeatRule || "none",
      source: t.source ?? "manual"
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      typeId: form.typeId ? Number(form.typeId) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      notes: form.notes,
      priority: form.priority,
      reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
      repeatRule: form.repeatRule,
      source: form.source,
    };
    if (editingTask) {
      await updateTask(editingTask.id, payload);
    } else {
      await addTask(payload);
    }
    setShowForm(false);
  };

  // URL hash 导入（来自浏览器扩展推送）
  const hashImportDone = useRef(false);
  useEffect(() => {
    if (hashImportDone.current || loading || !user || taskTypes.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#import=')) return;
    hashImportDone.current = true;

    try {
      const encoded = hash.slice('#import='.length);
      const data = JSON.parse(decodeURIComponent(encoded));
      if (!Array.isArray(data) || data.length === 0) return;
      (async () => {
        for (const item of data) {
          await addTask({
            title: item.title || item.name || '未命名任务',
            typeId: taskTypes[0]?.id || null,
            startDate: item.startDate || item.start || null,
            endDate: item.endDate || item.end || item.deadline || null,
            notes: item.notes || item.description || (item.course ? `${item.course} | ${item.type}` : ''),
            priority: 'medium',
            source: 'school',
          });
        }
        // 清理 hash 避免刷新重复导入
        history.replaceState(null, '', window.location.pathname + window.location.search);
      })();
    } catch { /* 忽略无效 hash */ }
  }, [loading, user, taskTypes, addTask]);

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    await addTaskType({ name: newTypeName.trim(), color: newTypeColor });
    setNewTypeName("");
  };

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const imported = JSON.parse(text);
      if (Array.isArray(imported) && imported.length > 0) {
        for (const item of imported) {
          await addTask({
            title: item.title || item.name || "未命名任务",
            typeId: taskTypes[0]?.id || null,
            startDate: item.startDate || item.start || null,
            endDate: item.endDate || item.end || item.deadline || null,
            notes: item.notes || item.description || "",
            priority: "medium",
            source: "school",
          });
        }
        alert(`成功导入 ${imported.length} 个任务`);
      }
    } catch (err) {
      alert("导入失败，请确保已从浏览器插件复制了正确的任务数据（JSON 格式）。\n\n提示：使用浏览器插件点击\"写入日程看板\"后，在此页面点击\"从存储拉取\"导入。");
    }
  };

  const handleStoragePull = async () => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      alert("此功能仅在作为 Chrome 扩展运行时可用。\n\n替代方案：在浏览器插件中点击\"复制 JSON\"，然后在此页面使用\"从剪贴板导入\"。");
      return;
    }
    try {
      const result = await chrome.storage.local.get("imau_import_queue");
      const queue = result.imau_import_queue || [];
      if (queue.length === 0) {
        alert("存储队列为空，请先在 IMAU 导入插件中点击\"写入日程看板\"。");
        return;
      }
      for (const item of queue) {
        await addTask({
          title: item.title || "未命名",
          typeId: taskTypes[0]?.id || null,
          startDate: null,
          endDate: item.endDate || null,
          notes: (item.course || "") + " | " + (item.type || ""),
          priority: "medium",
          source: "school",
        });
      }
      await chrome.storage.local.remove("imau_import_queue");
      alert("成功从存储导入 " + queue.length + " 个任务");
    } catch (err) {
      alert("从存储导入失败: " + err.message);
    }
  };

  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationEnabled(true);
        setNotifEnabled(true);
        alert("通知已开启！创建任务时设置提醒时间即可收到桌面通知。");
      } else {
        alert("通知权限被拒绝，请在浏览器设置中手动开启。");
      }
    } else {
      setNotificationEnabled(false);
      setNotifEnabled(false);
    }
  };

  const getTypeName = (typeId) => taskTypes.find(t => t.id === typeId)?.name ?? "未分类";
  const getTypeColor = (typeId) => taskTypes.find(t => t.id === typeId)?.color ?? "#6b7280";

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

  const weeklyStats = getWeeklyStats();
  const maxWeeklyCompleted = Math.max(1, ...weeklyStats.map(s => s.completed));
  const maxWeeklyCreated = Math.max(1, ...weeklyStats.map(s => s.created));

  if (showSplash) return <SplashScreen onEnter={() => setShowSplash(false)} />;

  if (authLoading) return <Skeleton />;

  // ===== Login / Register View =====
  if (!user) {
    const handleAuthSubmit = async (e) => {
      e.preventDefault();
      setAuthError('');
      setAuthSubmitting(true);
      if (authMode === 'register') {
        const { error } = await signUp(authEmail, authPassword);
        if (error) setAuthError(error.message);
        else setAuthError('注册成功！请查看邮箱验证（如未关闭验证则直接登录）');
      } else {
        const { error } = await signIn(authEmail, authPassword);
        if (error) setAuthError('邮箱或密码错误');
      }
      setAuthSubmitting(false);
    };

    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">日程看板</h1>
          <p className="auth-subtitle">登录后管理你的日程任务</p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <input
              type="email"
              placeholder="邮箱地址"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="密码"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              required
              minLength={6}
            />
            {authError && <div className="auth-error">{authError}</div>}
            <button type="submit" className="btn-primary auth-btn" disabled={authSubmitting}>
              {authSubmitting ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
            </button>
          </form>
          <div className="auth-switch">
            {authMode === 'login' ? (
              <span>还没有账号？<button className="link-btn" onClick={() => { setAuthMode('register'); setAuthError(''); }}>去注册</button></span>
            ) : (
              <span>已有账号？<button className="link-btn" onClick={() => { setAuthMode('login'); setAuthError(''); }}>去登录</button></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <Skeleton />;

  // Analytics
  const monthlyDistribution = {};
  activeTasks.forEach(t => {
    if (t.endDate) {
      const key = new Date(t.endDate).toISOString().slice(0, 7);
      monthlyDistribution[key] = (monthlyDistribution[key] || 0) + 1;
    }
  });
  const sortedMonths = Object.entries(monthlyDistribution).sort((a, b) => a[0].localeCompare(b[0]));
  const maxCount = Math.max(1, ...Object.values(monthlyDistribution));

  const typeDistribution = {};
  activeTasks.forEach(t => { const name = getTypeName(t.typeId); typeDistribution[name] = (typeDistribution[name] || 0) + 1; });
  const maxTypeCount = Math.max(1, ...Object.values(typeDistribution));

  const priorityCount = { high: 0, medium: 0, low: 0 };
  activeTasks.forEach(t => { priorityCount[t.priority || 'medium'] = (priorityCount[t.priority || 'medium'] || 0) + 1; });

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <h1 className="logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="logo-text">日程看板</span>
          </h1>
          <button
            className="sidebar-pin-btn"
            title={sidebarExpanded ? '收起侧边栏' : '固定展开'}
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarExpanded
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="17" y1="10" x2="3" y2="10"/><polyline points="10 3 3 10 10 17"/></>
              }
            </svg>
          </button>
        </div>
        <nav>
          <button className={`nav-btn ${view === "tasks" ? "active" : ""}`} onClick={() => setView("tasks")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="nav-label">任务列表</span>
          </button>
          <button className={`nav-btn ${view === "types" ? "active" : ""}`} onClick={() => setView("types")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span className="nav-label">任务类型</span>
          </button>
          <button className={`nav-btn ${view === "analytics" ? "active" : ""}`} onClick={() => setView("analytics")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
            <span className="nav-label">数据分析</span>
          </button>
          <button className={`nav-btn ${view === "pomodoro" ? "active" : ""}`} onClick={() => setView("pomodoro")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="nav-label">番茄钟</span>
          </button>
          <button className={`nav-btn ${view === "import" ? "active" : ""}`} onClick={() => setView("import")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="nav-label">导入数据</span>
          </button>
          <button className={`nav-btn ${view === "aiChat" ? "active" : ""}`} onClick={() => setView("aiChat")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span className="nav-label">AI 助手</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="notif-toggle" onClick={handleToggleNotif}>
            <span className={`notif-dot ${notifEnabled ? "on" : ""}`} />
            <span className="notif-label">{notifEnabled ? "通知已开启" : "点击开启通知"}</span>
          </div>
        </div>

        <div className="sidebar-stats">
          <div className="stat"><span className="stat-val">{activeTasks.length}</span><span className="stat-label">进行中</span></div>
          <div className="stat"><span className="stat-val">{completedTasks.length}</span><span className="stat-label">已完成</span></div>
        </div>

        <div className="sidebar-section">
          <div className="user-info">
            <span className="user-email" title={user.email}>{user.email}</span>
            <button className="btn-secondary logout-btn" onClick={signOut}>退出登录</button>
          </div>
        </div>
      </aside>

      <main className={`main ${sidebarExpanded ? 'pushed' : ''}`}>
        {view === "tasks" && (
          <>
            <header className="main-header">
              <h2>所有任务</h2>
              <button className="btn-primary" onClick={openNew}>+ 新建任务</button>
            </header>

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
                      onOpenDetail={() => { setSelectedTask(t); setView("taskDetail"); }}
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
                      onOpenDetail={() => { setSelectedTask(t); setView("taskDetail"); }}
                      subtaskProps={{ getSubtasks, addSubtask, toggleSubtask, deleteSubtask }} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {view === "types" && (
          <>
            <header className="main-header"><h2>任务类型管理</h2></header>
            <div className="type-form">
              <input placeholder="类型名称 (如: 考试、作业、实验)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddType()} />
              <div className="color-picker">
                {COLORS.map(c => <span key={c} className={`color-swatch ${c === newTypeColor ? "selected" : ""}`} style={{ background: c }} onClick={() => setNewTypeColor(c)} />)}
              </div>
              <button className="btn-primary" onClick={handleAddType}>添加类型</button>
            </div>
            <div className="type-list">
              {taskTypes.map(t => (
                <div key={t.id} className="type-item">
                  <span className="type-dot" style={{ background: t.color }} />
                  <span className="type-name">{t.name}</span>
                  <button className="btn-icon" onClick={() => deleteTaskType(t.id)} title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
              ))}
              {taskTypes.length === 0 && <div className="empty">暂无任务类型</div>}
            </div>
          </>
        )}

        {view === "analytics" && (
          <AnalyticsView
            tasks={tasks} activeTasks={activeTasks} completedTasks={completedTasks}
            taskTypes={taskTypes} weeklyStats={weeklyStats}
            maxWeeklyCompleted={maxWeeklyCompleted} maxWeeklyCreated={maxWeeklyCreated}
            sortedMonths={sortedMonths} maxCount={maxCount}
            typeDistribution={typeDistribution} maxTypeCount={maxTypeCount}
            priorityCount={priorityCount}
          />
        )}

        {view === "pomodoro" && (
          <>
            <header className="main-header"><h2>番茄钟</h2></header>
            <div className="pomodoro-container">
              <PomodoroTimer />
              <div className="pomodoro-info">
                <h4>什么是番茄钟？</h4>
                <p>番茄工作法是一种时间管理方法：</p>
                <ul>
                  <li><strong>专注 25 分钟</strong>：全神贯注工作</li>
                  <li><strong>短休息 5 分钟</strong>：放松大脑</li>
                  <li><strong>长休息 15 分钟</strong>：每 4 个番茄后</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {view === "taskDetail" && selectedTask && (
          <TaskDetailPage
            task={selectedTask}
            onBack={() => { setView("tasks"); setSelectedTask(null); }}
          />
        )}

        {view === "import" && (
          <>
            <header className="main-header"><h2>导入数据</h2></header>
            <div className="import-area">
              <div className="import-card">
                <h3>从剪贴板导入</h3>
                <p>在浏览器插件中点击"复制 JSON"，然后回到此页面点击下方按钮导入。</p>
                <button className="btn-primary" onClick={handleImport}>从剪贴板导入</button>
              </div>
              <div className="import-card">
                <h3>从浏览器存储导入</h3>
                <p>在 IMAU 导入插件中点击"写入日程看板"，然后在此页面点击下方按钮拉取。</p>
                <button className="btn-accent" onClick={handleStoragePull}>从存储拉取</button>
              </div>
              <div className="import-card">
                <h3>手动粘贴 JSON</h3>
                <p>如果你已经有导出的 JSON 数据，可以直接粘贴。</p>
                <button className="btn-secondary" onClick={handleImport}>读取剪贴板 JSON</button>
              </div>
              <div className="import-card">
                <h3>导出数据</h3>
                <p>将所有任务导出为 JSON 文件，方便备份或迁移。</p>
                <button className="btn-primary" onClick={() => {
                  const data = JSON.stringify(tasks, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `schedule-export-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
                }}>导出 JSON</button>
              </div>
              <div className="import-card">
                <h3>导出 CSV</h3>
                <p>将任务导出为 CSV 表格，方便在 Excel 中查看。</p>
                <button className="btn-secondary" onClick={() => {
                  const headers = ['id', 'title', 'type', 'priority', 'startDate', 'endDate', 'completed', 'notes'];
                  const rows = tasks.map(t => [t.id, t.title, getTypeName(t.typeId), t.priority || 'medium', t.startDate || '', t.endDate || '', t.completed ? '是' : '否', t.notes || '']);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `schedule-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
                }}>导出 CSV</button>
              </div>
            </div>
          </>
        )}

        {view === "aiChat" && (
          <AIChat
            tasks={tasks}
            taskTypes={taskTypes}
            addTask={addTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
            toggleComplete={toggleComplete}
            refresh={refresh}
          />
        )}

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>{editingTask ? "编辑任务" : "新建任务"}</h3>
              <form onSubmit={handleSubmit}>
                <label>任务名称</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="输入任务名称" />

                <div className="form-row">
                  <div>
                    <label>任务类型</label>
                    <select value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}>
                      <option value="">无分类</option>
                      {taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>优先级</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div><label>开始日期</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div><label>截止日期</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>

                <div className="form-row">
                  <div>
                    <label>重复</label>
                    <select value={form.repeatRule} onChange={e => setForm({ ...form, repeatRule: e.target.value })}>
                      <option value="none">不重复</option>
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                    </select>
                  </div>
                  <div>
                    <label>提醒时间 {notifEnabled ? <span className="hint">（通知已开启）</span> : <span className="hint warn">（通知未开启）</span>}</label>
                    <input type="datetime-local" value={form.reminderAt} onChange={e => setForm({ ...form, reminderAt: e.target.value })} />
                  </div>
                </div>

                <label>备注</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="可选备注" rows={2} />
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
                  <button type="submit" className="btn-primary">{editingTask ? "保存" : "创建"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TaskCard({ task, typeName, color, done, onToggle, onEdit, onDelete, onExpand, onOpenDetail, expanded, subtaskProps }) {
  const cd = formatCountdown(task);
  const priorityLabel = { high: "高", medium: "中", low: "低" }[task.priority || "medium"];
  const priorityColor = { high: "#d9544f", medium: "#d4855e", low: "#5b9bd5" }[task.priority || "medium"];
  const repeatLabel = { daily: "每天", weekly: "每周", none: "" }[task.repeatRule || "none"];

  return (
    <div className={`task-card${done ? " done" : ""}`} style={{ borderLeftColor: done ? undefined : color }}>
      <div className="task-card-top">
        <div className="task-badges">
          <span className="task-type-badge" style={{ background: color }}>{typeName}</span>
          <span className="task-priority-badge" style={{ background: priorityColor + "22", color: priorityColor, border: `1px solid ${priorityColor}44` }}>{priorityLabel}</span>
          {repeatLabel && <span className="task-repeat-badge">{repeatLabel}</span>}
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
      <h4 className="task-title" style={{ cursor: 'pointer' }} onClick={onOpenDetail} title="点击查看详情">{task.title}</h4>
      <div className="task-meta">
        {task.startDate && <span>开始: {fmtDate(task.startDate)}</span>}
        {task.endDate && <span>截止: {fmtDate(task.endDate)}</span>}
        {task.reminderAt && <span className="reminder-tag">提醒: {new Date(task.reminderAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <div className="task-bottom">
        <span className={`countdown${cd.urgent ? " urgent" : ""}`}>{cd.text}</span>
        <div className="task-bottom-actions">
          <button className={`toggle-btn${done ? " done" : ""}`} onClick={onToggle}>
            {done ? "↩ 恢复" : "✓ 完成"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Analytics View Component =====
function AnalyticsView({ tasks, activeTasks, completedTasks, taskTypes, weeklyStats, maxWeeklyCompleted, maxWeeklyCreated, sortedMonths, maxCount, typeDistribution, maxTypeCount, priorityCount }) {
  const procrastinationIndex = calcProcrastinationIndex(tasks);
  const deadlinePressure = getDeadlinePressure(tasks);
  const streakData = getStreakData(tasks);

  const maxPressure = Math.max(1, ...deadlinePressure.map(d => d.count));
  const upcomingDeadlines = deadlinePressure.filter(d => d.count > 0);
  const highPressureDays = deadlinePressure.filter(d => d.count >= 3);

  // Streak color levels (GitHub style)
  const getStreakColor = (count) => {
    if (count === 0) return 'var(--surface2)';
    if (count === 1) return '#c8e6d4';
    if (count === 2) return '#8cc9a0';
    if (count <= 4) return '#4da16a';
    return '#2d6a4f';
  };

  // Group streak days into weeks for grid display
  const weeks = [];
  for (let i = 0; i < streakData.days.length; i += 7) {
    weeks.push(streakData.days.slice(i, i + 7));
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <>
      <header className="main-header"><h2>数据分析</h2></header>
      <div className="analytics-grid">

        {/* Procrastination Index */}
        <div className="chart-card procrastination-card">
          <h4>拖延指数</h4>
          {procrastinationIndex === null ? (
            <div className="empty">完成带截止日期的任务后生成评分</div>
          ) : (
            <div className="procrastination-content">
              <div className="procrastination-score" style={{
                color: procrastinationIndex >= 80 ? '#3d7a5c' : procrastinationIndex >= 60 ? '#d4a853' : '#d9544f'
              }}>
                {procrastinationIndex}
                <span className="procrastination-max">/100</span>
              </div>
              <div className="procrastination-label">
                {procrastinationIndex >= 80 ? '效率达人' : procrastinationIndex >= 60 ? '还可以' : procrastinationIndex >= 40 ? '有点拖延' : '重度拖延'}
              </div>
              <div className="procrastination-bar">
                <div className="procrastination-fill" style={{
                  width: `${procrastinationIndex}%`,
                  background: procrastinationIndex >= 80 ? '#3d7a5c' : procrastinationIndex >= 60 ? '#d4a853' : '#d9544f'
                }} />
              </div>
              <p className="procrastination-hint">
                基于已完成的任务中，准时完成率和平均提前天数计算
              </p>
            </div>
          )}
        </div>

        {/* Deadline Pressure */}
        <div className="chart-card pressure-card">
          <h4>未来30天 Deadline 压力</h4>
          {upcomingDeadlines.length === 0 ? (
            <div className="empty">未来30天暂无截止任务</div>
          ) : (
            <>
              <div className="pressure-chart">
                {deadlinePressure.map(d => (
                  <div key={d.date} className="pressure-col" title={`${d.date}: ${d.count}个任务`}>
                    <div className="pressure-bar-wrapper">
                      <div
                        className="pressure-bar"
                        style={{
                          height: `${(d.count / maxPressure) * 80}px`,
                          background: d.count >= 3 ? '#d9544f' : d.count >= 1 ? '#d4855e' : 'var(--surface2)',
                          opacity: d.isWeekend ? 0.6 : 1,
                        }}
                      />
                    </div>
                    <span className={`pressure-label ${d.count >= 3 ? 'urgent' : ''}`}>{d.label}</span>
                  </div>
                ))}
              </div>
              {highPressureDays.length > 0 && (
                <div className="pressure-warning">
                  <span className="warning-icon">⚠️</span>
                  {highPressureDays.length} 天任务堆积（≥3个），建议提前规划！
                </div>
              )}
            </>
          )}
        </div>

        {/* Streak Calendar */}
        <div className="chart-card streak-card">
          <h4>连续打卡日历</h4>
          <div className="streak-header">
            <div className="streak-badge">
              <span className="streak-number">{streakData.currentStreak}</span>
              <span className="streak-text">当前连续</span>
            </div>
            <div className="streak-badge">
              <span className="streak-number">{streakData.maxStreak}</span>
              <span className="streak-text">最长连续</span>
            </div>
          </div>
          <div className="streak-calendar">
            <div className="streak-weekdays">
              {weekDays.map(d => <span key={d} className="streak-weekday">{d}</span>)}
            </div>
            <div className="streak-weeks">
              {weeks.map((week, wi) => (
                <div key={wi} className="streak-week">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="streak-day"
                      style={{ background: getStreakColor(day.count) }}
                      title={`${day.date}: 完成${day.count}个任务`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="streak-legend">
            <span>少</span>
            <div className="streak-legend-day" style={{ background: 'var(--surface2)' }} />
            <div className="streak-legend-day" style={{ background: '#0e4429' }} />
            <div className="streak-legend-day" style={{ background: '#006d32' }} />
            <div className="streak-legend-day" style={{ background: '#26a641' }} />
            <div className="streak-legend-day" style={{ background: '#39d353' }} />
            <span>多</span>
          </div>
        </div>

        {/* Existing charts */}
        <div className="chart-card">
          <h4>近7日完成情况</h4>
          <div className="weekly-chart">
            {weeklyStats.map(s => (
              <div key={s.date} className="weekly-col">
                <div className="weekly-bars">
                  <div className="weekly-bar completed" style={{ height: `${(s.completed / maxWeeklyCompleted) * 60}px` }} />
                  <div className="weekly-bar created" style={{ height: `${(s.created / maxWeeklyCreated) * 60}px` }} />
                </div>
                <span className="weekly-label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="weekly-legend">
            <span><span className="legend-dot" style={{ background: 'var(--success)' }} />完成</span>
            <span><span className="legend-dot" style={{ background: 'var(--primary)' }} />新增</span>
          </div>
        </div>

        <div className="chart-card">
          <h4>每月任务分布</h4>
          {sortedMonths.length === 0 ? <div className="empty">暂无数据</div> : (
            <div className="bar-chart">
              {sortedMonths.map(([month, count]) => {
                const pct = (count / maxCount) * 100;
                return (
                  <div key={month} className="bar-row">
                    <span className="bar-label">{month}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                    <span className="bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="chart-card">
          <h4>按类型统计</h4>
          {Object.keys(typeDistribution).length === 0 ? <div className="empty">暂无数据</div> : (
            <div className="type-chart">
              {Object.entries(typeDistribution).map(([name, count]) => {
                const pct = (count / maxTypeCount) * 100;
                return (
                  <div key={name} className="type-stat-row">
                    <span className="type-stat-name">{name}</span>
                    <span className="type-stat-bar" style={{ width: pct + "%" }} />
                    <span className="type-stat-count">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="chart-card">
          <h4>优先级分布</h4>
          <div className="priority-chart">
            <div className="priority-row">
              <span className="priority-label high">高</span>
              <div className="priority-track"><div className="priority-fill high" style={{ width: `${activeTasks.length ? (priorityCount.high / activeTasks.length) * 100 : 0}%` }} /></div>
              <span className="priority-count">{priorityCount.high}</span>
            </div>
            <div className="priority-row">
              <span className="priority-label medium">中</span>
              <div className="priority-track"><div className="priority-fill medium" style={{ width: `${activeTasks.length ? (priorityCount.medium / activeTasks.length) * 100 : 0}%` }} /></div>
              <span className="priority-count">{priorityCount.medium}</span>
            </div>
            <div className="priority-row">
              <span className="priority-label low">低</span>
              <div className="priority-track"><div className="priority-fill low" style={{ width: `${activeTasks.length ? (priorityCount.low / activeTasks.length) * 100 : 0}%` }} /></div>
              <span className="priority-count">{priorityCount.low}</span>
            </div>
          </div>
        </div>

        <div className="chart-card summary-card">
          <h4>总览</h4>
          <div className="summary-grid">
            <div className="summary-item"><span className="sum-val">{tasks.length}</span><span>总任务数</span></div>
            <div className="summary-item"><span className="sum-val">{activeTasks.length}</span><span>进行中</span></div>
            <div className="summary-item"><span className="sum-val">{completedTasks.length}</span><span>已完成</span></div>
            <div className="summary-item"><span className="sum-val">{Math.round(tasks.length ? (completedTasks.length / tasks.length) * 100 : 0)}%</span><span>完成率</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
