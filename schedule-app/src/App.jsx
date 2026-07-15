import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTasks, isNotificationEnabled, setNotificationEnabled, requestNotificationPermission } from "./hooks/useTasks";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery } from "./hooks/useMediaQuery";
import useSettings, { sendPushPlus } from "./hooks/useSettings";
import AIChat from "./components/AIChat";
import SplashScreen from "./components/SplashScreen";
import Skeleton from "./components/Skeleton";
import ScheduleView from "./components/ScheduleView";
import ToastContainer, { toast } from "./components/Toast";
import LoginPage from "./components/LoginPage";
import AnalyticsPage from "./components/AnalyticsPage";
import TasksPage from "./components/TasksPage";
import ToolboxPage from "./components/ToolboxPage";
import ImportPage from "./components/ImportPage";
import TaskDetailWrapper from "./components/TaskDetailWrapper";

function App() {
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();

  const {
    tasks, taskTypes, loading, activeTasks, completedTasks, deletedTasks,
    addTask, updateTask, deleteTask, restoreTask, permanentDelete, toggleComplete,
    addTaskType, deleteTaskType, refresh,
    getSubtasks, addSubtask, toggleSubtask, deleteSubtask,
    getWeeklyStats,
  } = useTasks();

  const { pushplusToken, setPushplusToken } = useSettings(user);

  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.slice(1) || "tasks";

  const [showSplash, setShowSplash] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [notifEnabled, setNotifEnabled] = useState(isNotificationEnabled());
  const [theme, setTheme] = useState(() => localStorage.getItem('ima_theme') || 'dark');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    title: "", typeId: "", startDate: "", endDate: "", notes: "",
    priority: "medium", reminderAt: "", repeatRule: "none", source: "manual"
  });

  // 任务到期提醒检查（浏览器通知 + 微信推送）
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
            // 浏览器通知
            new Notification('任务即将到期', {
              body: `「${t.title}」将于 ${t.endDate} 截止，请尽快处理`,
              icon: '/favicon.ico'
            });
            // 微信推送（如果已配置）
            if (pushplusToken) {
              sendPushPlus(
                pushplusToken,
                '任务即将到期',
                `<b>「${t.title}」</b><br/>截止日期：${t.endDate}<br/>请尽快处理 ⏰`
              ).catch(() => {}); // 静默失败，不影响浏览器通知
            }
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
  }, [notifEnabled, activeTasks, pushplusToken]);

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

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [location.pathname, isMobile]);

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
    // 从 timestamptz 提取纯日期部分（type="date" input 只接受 YYYY-MM-DD）
    const toDateOnly = (d) => { if (!d) return ""; return String(d).slice(0, 10); };
    setForm({
      title: t.title, typeId: t.typeId ?? "", startDate: toDateOnly(t.startDate),
      endDate: toDateOnly(t.endDate), notes: t.notes ?? "", priority: t.priority ?? "medium",
      reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : "",
      repeatRule: t.repeatRule || "none",
      source: t.source ?? "manual"
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 所有时间字段统一用北京时间（+08:00）存储，避免 Supabase 东京时区偏移
    const payload = {
      title: form.title,
      typeId: form.typeId ? Number(form.typeId) : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      notes: form.notes,
      priority: form.priority,
      reminderAt: form.reminderAt ? (form.reminderAt.includes('Z') || form.reminderAt.includes('+') ? form.reminderAt : form.reminderAt + ':00+08:00') : null,
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

  const weeklyStats = getWeeklyStats();
  const maxWeeklyCompleted = Math.max(1, ...weeklyStats.map(s => s.completed));
  const maxWeeklyCreated = Math.max(1, ...weeklyStats.map(s => s.created));

  if (showSplash) return <SplashScreen onEnter={() => setShowSplash(false)} />;

  if (authLoading) return <Skeleton />;

  // ===== Login / Register View =====
  if (!user) return <LoginPage />;

  if (loading) return <Skeleton />;

  // ===== Analytics helpers =====
  const typeDistribution = {};
  activeTasks.forEach(t => { const name = getTypeName(t.typeId); typeDistribution[name] = (typeDistribution[name] || 0) + 1; });

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
          <NavLink to="/" className={() => `nav-btn ${(currentView === "tasks" || currentView === "taskDetail") ? "active" : ""}`} end>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="nav-label">任务列表</span>
          </NavLink>
          <NavLink to="/schedule" className={() => `nav-btn ${currentView === "schedule" ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
            <span className="nav-label">您的课表</span>
          </NavLink>
          <NavLink to="/analytics" className={() => `nav-btn ${currentView === "analytics" ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
            <span className="nav-label">数据分析</span>
          </NavLink>
          <NavLink to="/toolbox" className={() => `nav-btn ${currentView === "toolbox" ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span className="nav-label">工具箱</span>
          </NavLink>
          <NavLink to="/import" className={() => `nav-btn ${currentView === "import" ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="nav-label">数据处理</span>
          </NavLink>
          <NavLink to="/chat" className={() => `nav-btn ${currentView === "chat" ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span className="nav-label">AI 助手</span>
          </NavLink>
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
            <div className="settings-item settings-pushplus">
              <span className="settings-item-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                微信提醒
              </span>
              <span className="pushplus-hint">
                {pushplusToken ? '已配置 ✓' : '未配置'}
              </span>
            </div>
            {settingsOpen && (
              <div className="settings-pushplus-input" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  className="pushplus-token-input"
                  placeholder="粘贴 PushPlus Token..."
                  value={pushplusToken}
                  onChange={e => setPushplusToken(e.target.value.trim())}
                />
                {pushplusToken && (
                  <button className="pushplus-clear-btn" onClick={() => setPushplusToken('')} title="清除">✕</button>
                )}
                <div className="pushplus-help">
                  获取 Token：访问 <a href="https://www.pushplus.plus" target="_blank" rel="noopener noreferrer">pushplus.plus</a> → 登录 → 一对一推送
                </div>
              </div>
            )}
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

        <Routes>
          <Route path="/" element={
            <TasksPage
              tasks={tasks} taskTypes={taskTypes} activeTasks={activeTasks} completedTasks={completedTasks}
              deletedTasks={deletedTasks}
              addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} restoreTask={restoreTask}
              permanentDelete={permanentDelete} toggleComplete={toggleComplete}
              addTaskType={addTaskType} deleteTaskType={deleteTaskType} refresh={refresh}
              getSubtasks={getSubtasks} addSubtask={addSubtask} toggleSubtask={toggleSubtask} deleteSubtask={deleteSubtask}
              openNew={openNew} openEdit={openEdit} getTypeName={getTypeName} getTypeColor={getTypeColor}
              pushplusToken={pushplusToken}
            />
          } />
          <Route path="/analytics" element={
            <AnalyticsPage
              tasks={tasks} activeTasks={activeTasks} completedTasks={completedTasks}
              taskTypes={taskTypes} weeklyStats={weeklyStats}
              maxWeeklyCompleted={maxWeeklyCompleted} maxWeeklyCreated={maxWeeklyCreated}
              typeDistribution={typeDistribution}
            />
          } />
          <Route path="/toolbox" element={<ToolboxPage />} />
          <Route path="/task/:taskId" element={<TaskDetailWrapper tasks={tasks} isMobile={isMobile} pushplusToken={pushplusToken} />} />
          <Route path="/schedule" element={
            <ScheduleView
              tasks={tasks} taskTypes={taskTypes}
              addTask={addTask} addTaskType={addTaskType}
              refresh={refresh} getTypeName={getTypeName} getTypeColor={getTypeColor}
            />
          } />
          <Route path="/import" element={<ImportPage tasks={tasks} taskTypes={taskTypes} addTask={addTask} getTypeName={getTypeName} handleImport={handleImport} handleStoragePull={handleStoragePull} />} />
          <Route path="/chat" element={<AIChat tasks={tasks} taskTypes={taskTypes} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} toggleComplete={toggleComplete} refresh={refresh} />} />
        </Routes>

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

export default App;
