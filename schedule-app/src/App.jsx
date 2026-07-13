import { useState, useEffect, useRef } from "react";
import { useTasks, isNotificationEnabled, setNotificationEnabled, requestNotificationPermission } from "./hooks/useTasks";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { formatCountdown, fmtDate } from "./utils/dateUtils";
import AIChat from "./components/AIChat";
import SplashScreen from "./components/SplashScreen";
import Skeleton from "./components/Skeleton";
import TaskDetailPage from "./components/TaskDetailPage";
import ScheduleView from "./components/ScheduleView";
import PlusMenu from "./components/PlusMenu";
import TimelineMemoView from "./components/TimelineMemoView";
import MonthView from "./components/MonthView";
import ToastContainer, { toast } from "./components/Toast";
import LoginPage from "./components/LoginPage";
import AnalyticsPage from "./components/AnalyticsPage";
import PomodoroTimer from "./components/PomodoroTimer";
import SubtaskList from "./components/SubtaskList";

const COLORS = ["#5b9bd5", "#d9544f", "#3d7a5c", "#d4a853", "#7c6fb0", "#d4668e", "#3ba3b8", "#d4855e"];

function App() {
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();

  const {
    tasks, taskTypes, loading, activeTasks, completedTasks,
    addTask, updateTask, deleteTask, toggleComplete,
    addTaskType, deleteTaskType, refresh,
    getSubtasks, addSubtask, toggleSubtask, deleteSubtask,
    getWeeklyStats,
  } = useTasks();

  const [view, setView] = useState("tasks");
  const [taskViewMode, setTaskViewMode] = useState("list"); // "list" | "timeline" | "month"
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
  const [theme, setTheme] = useState(() => localStorage.getItem('ima_theme') || 'light');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ima_theme', theme);
  }, [theme]);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  // Close mobile sidebar on view change
  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [view, isMobile]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

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
        toast(`成功导入 ${imported.length} 个任务`, 'success');
      }
    } catch (err) {
      toast('导入失败，请确保已从浏览器插件复制了正确的任务数据（JSON 格式）', 'error');
    }
  };

  const handleStoragePull = async () => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      toast('此功能仅在作为 Chrome 扩展运行时可用', 'warning');
      return;
    }
    try {
      const result = await chrome.storage.local.get("imau_import_queue");
      const queue = result.imau_import_queue || [];
      if (queue.length === 0) {
        toast('存储队列为空，请先在 IMAU 导入插件中点击"写入日程看板"', 'info');
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
      toast('成功从存储导入 ' + queue.length + ' 个任务', 'success');
    } catch (err) {
      toast('从存储导入失败: ' + err.message, 'error');
    }
  };

  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationEnabled(true);
        setNotifEnabled(true);
        toast('通知已开启！创建任务时设置提醒时间即可收到桌面通知', 'success');
      } else {
        toast('通知权限被拒绝，请在浏览器设置中手动开启', 'error');
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
  if (!user) return <LoginPage />;

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
      {/* Mobile overlay */}
      {isMobile && mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${isMobile ? 'mobile' : sidebarExpanded ? 'expanded' : 'collapsed'} ${isMobile && mobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-inner">
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
          <button className={`nav-btn ${view === "schedule" ? "active" : ""}`} onClick={() => setView("schedule")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
            <span className="nav-label">您的课表</span>
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

        <div className="settings-wrapper" ref={settingsRef}>
          <div className={`settings-dropdown ${settingsOpen ? 'open' : ''}`}>
            <div className="settings-dropdown-header">
              <div className="settings-dropdown-email" title={user.email}>{user.email}</div>
            </div>
            <div className="settings-item" onClick={toggleTheme}>
              <span className="settings-item-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {theme === 'light'
                    ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
                    : <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>
                  }
                </svg>
                {theme === 'light' ? '浅色模式' : '深色模式'}
              </span>
              <div className="theme-switch" />
            </div>
            <div className="settings-divider" />
            <div className="settings-logout" onClick={() => { setSettingsOpen(false); signOut(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              退出登录
            </div>
          </div>
          <button className="settings-btn" onClick={() => setSettingsOpen(o => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="nav-label">设置</span>
          </button>
        </div>
        </div>
      </aside>

      <main className={`main ${sidebarExpanded ? 'pushed' : ''}`}>
        {/* Mobile hamburger */}
        {isMobile && (
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="菜单">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}

        {view === "tasks" && (
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

        {taskViewMode === "timeline" && (
          <TimelineMemoView
            tasks={tasks}
            taskTypes={taskTypes}
            getTypeName={getTypeName}
            getTypeColor={getTypeColor}
            onOpenDetail={(t) => { setSelectedTask(t); setView("taskDetail"); }}
            onQuickAdd={async ({ title, date, periodIndex, periodName, periodTime, typeId }) => {
              const endDate = date;
              await addTask({
                title,
                typeId: typeId || null,
                startDate: date,
                endDate,
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
            onOpenDetail={(t) => { setSelectedTask(t); setView("taskDetail"); }}
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
        )}

        {view === "analytics" && (
          <AnalyticsPage
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
            isMobile={isMobile}
            onBack={() => { setView("tasks"); setSelectedTask(null); }}
          />
        )}

        {view === "schedule" && (
          <ScheduleView />
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
      <ToastContainer />
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

export default App;
