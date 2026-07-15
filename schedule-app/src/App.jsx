import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTasks, isNotificationEnabled, setNotificationEnabled, requestNotificationPermission } from "./hooks/useTasks";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery } from "./hooks/useMediaQuery";
import useSettings, { sendPushPlus } from "./hooks/useSettings";
import AIChat from "./components/AIChat";
import SplashScreen from "./components/SplashScreen";
import Skeleton from "./components/Skeleton";
import ToastContainer, { toast } from "./components/Toast";
import LoginPage from "./components/LoginPage";
import AnalyticsPage from "./components/AnalyticsPage";
import TasksPage from "./components/TasksPage";
import ImportPage from "./components/ImportPage";
import ToolboxPage from "./components/ToolboxPage";
import TaskDetailWrapper from "./components/TaskDetailWrapper";

function App() {
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();
  const { tasks, taskTypes, loading, activeTasks, completedTasks, trashTasks, addTask, updateTask, deleteTask, restoreTask, permanentDelete, toggleComplete, addTaskType, deleteTaskType, refresh, getSubtasks, addSubtask, toggleSubtask, deleteSubtask } = useTasks();
  const { pushplusToken, setPushplusToken } = useSettings(user);
  const navigate = useNavigate(); const location = useLocation(); const currentView = location.pathname.slice(1) || "tasks";
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
  const [form, setForm] = useState({ title: "", typeId: "", startDate: "", endDate: "", notes: "", priority: "medium", reminderAt: "", repeatRule: "none", source: "manual" });

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('ima_theme', theme); }, [theme]);
  useEffect(() => { if (!settingsOpen) return; const handler = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, [settingsOpen]);
  useEffect(() => { if (isMobile) setMobileSidebarOpen(false); }, [location.pathname, isMobile]);

  // 任务到期提醒
  useEffect(() => {
    if (!notifEnabled || Notification.permission !== 'granted') return;
    const checkDeadlines = () => {
      const now = new Date(); const tomorrow = new Date(now.getTime() + 86400000);
      let notified = {}; try { notified = JSON.parse(localStorage.getItem('ima_notified_tasks') || '{}'); } catch {}
      activeTasks.forEach(t => {
        if (!t.endDate || t.completed) return;
        const end = new Date(t.endDate + 'T23:59:59');
        if (end <= tomorrow && end > now) {
          const key = `${t.id}_${new Date().toISOString().slice(0, 10)}`;
          if (!notified[key]) {
            new Notification('任务即将到期', { body: `「${t.title}」将于 ${t.endDate} 截止`, icon: '/favicon.ico' });
            if (pushplusToken) sendPushPlus(pushplusToken, '任务即将到期', `<b>「${t.title}」</b><br/>截止日期：${t.endDate}<br/>请尽快处理 ⏰`).catch(() => {});
            notified[key] = true;
          }
        }
      });
      localStorage.setItem('ima_notified_tasks', JSON.stringify(notified));
    };
    checkDeadlines(); const id = setInterval(checkDeadlines, 300000); return () => clearInterval(id);
  }, [notifEnabled, activeTasks, pushplusToken]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const openNew = () => { setEditingTask(null); setForm({ title: "", typeId: taskTypes[0]?.id || "", startDate: "", endDate: "", notes: "", priority: "medium", reminderAt: "", repeatRule: "none", source: "manual" }); setShowForm(true); };
  const openEdit = (t) => { setEditingTask(t); const toDateOnly = (d) => d ? String(d).slice(0, 10) : ""; setForm({ title: t.title, typeId: t.typeId ?? "", startDate: toDateOnly(t.startDate), endDate: toDateOnly(t.endDate), notes: t.notes ?? "", priority: t.priority ?? "medium", reminderAt: t.reminderAt ? new Date(t.reminderAt).toISOString().slice(0, 16) : "", repeatRule: t.repeatRule || "none", source: t.source ?? "manual" }); setShowForm(true); };
  const handleSubmit = async (e) => { e.preventDefault(); const payload = { title: form.title, typeId: form.typeId ? Number(form.typeId) : null, startDate: form.startDate || null, endDate: form.endDate || null, notes: form.notes, priority: form.priority, reminderAt: form.reminderAt ? (form.reminderAt.includes('Z') || form.reminderAt.includes('+') ? form.reminderAt : form.reminderAt + ':00+08:00') : null, repeatRule: form.repeatRule, source: form.source }; if (editingTask) await updateTask(editingTask.id, payload); else await addTask(payload); setShowForm(false); };

  const getTypeName = (typeId) => taskTypes.find(t => t.id === typeId)?.name ?? "未分类";
  const getTypeColor = (typeId) => taskTypes.find(t => t.id === typeId)?.color ?? "#6b7280";

  const handleToggleNotif = async () => {
    if (!notifEnabled) { const granted = await requestNotificationPermission(); if (granted) { setNotificationEnabled(true); setNotifEnabled(true); toast('通知已开启', 'success'); } else toast('通知权限被拒绝', 'error'); }
    else { setNotificationEnabled(false); setNotifEnabled(false); }
  };

  if (showSplash) return <SplashScreen onEnter={() => setShowSplash(false)} />;
  if (authLoading) return <Skeleton />;
  if (!user) return <LoginPage />;
  if (loading) return <Skeleton />;

  return (
    <div className="app">
      {isMobile && mobileSidebarOpen && <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />}
      <aside className={`sidebar ${isMobile ? 'mobile' : sidebarExpanded ? 'expanded' : 'collapsed'} ${isMobile && mobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-inner">
        <div className="sidebar-header">
          <h1 className="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="logo-text">日程看板</span>
          </h1>
          <button className="sidebar-pin-btn" title={sidebarExpanded ? '收起' : '固定展开'} onClick={() => setSidebarExpanded(!sidebarExpanded)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{sidebarExpanded ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="17" y1="10" x2="3" y2="10"/><polyline points="10 3 3 10 10 17"/></>}</svg>
          </button>
        </div>
        <nav>
          <NavLink to="/" className={() => `nav-btn ${(currentView === "tasks" || currentView === "taskDetail") ? "active" : ""}`} end>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="nav-label">任务列表</span>
          </NavLink>
          <NavLink to="/analytics" className={() => `nav-btn ${currentView === "analytics" ? "active" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
            <span className="nav-label">数据分析</span>
          </NavLink>
          <NavLink to="/chat" className={() => `nav-btn ${currentView === "chat" ? "active" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span className="nav-label">AI 助手</span>
          </NavLink>
          <NavLink to="/toolbox" className={() => `nav-btn ${currentView === "toolbox" ? "active" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span className="nav-label">工具箱</span>
          </NavLink>
          <NavLink to="/import" className={() => `nav-btn ${currentView === "import" ? "active" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="nav-label">数据处理</span>
          </NavLink>
        </nav>

        <div className="sidebar-section">
          <div className="notif-toggle" onClick={handleToggleNotif}>
            <span className={`notif-dot ${notifEnabled ? "on" : ""}`} />
            <span className="notif-label">{notifEnabled ? "通知已开" : "开启通知"}</span>
          </div>
        </div>
        <div className="sidebar-stats">
          <div className="stat"><span className="stat-val">{activeTasks.length}</span><span className="stat-label">进行中</span></div>
          <div className="stat"><span className="stat-val">{completedTasks.length}</span><span className="stat-label">已完成</span></div>
        </div>

        <div className="settings-wrapper" ref={settingsRef}>
          <div className={`settings-dropdown ${settingsOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="settings-dropdown-header"><div className="settings-dropdown-email" title={user.email}>{user.email}</div></div>
            <div className="settings-item" onClick={toggleTheme}>
              <span className="settings-item-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {theme === 'light' ? (
                    <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
                  ) : (
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  )}
                </svg>
                {theme === 'light' ? '浅色模式' : '深色模式'}
              </span>
            </div>
            <div className="settings-item settings-pushplus">
              <span className="settings-item-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>微信提醒</span>
              <span className="pushplus-hint">{pushplusToken ? '已配置 ✓' : '未配置'}</span>
            </div>
            {settingsOpen && (
              <div className="settings-pushplus-input" onClick={e => e.stopPropagation()}>
                <input type="text" className="pushplus-token-input" placeholder="粘贴 PushPlus Token..." value={pushplusToken} onChange={e => setPushplusToken(e.target.value.trim())} />
                {pushplusToken && <button className="pushplus-clear-btn" onClick={() => setPushplusToken('')} title="清除">✕</button>}
                <div className="pushplus-help">获取 Token：访问 <a href="https://www.pushplus.plus" target="_blank" rel="noopener noreferrer">pushplus.plus</a> → 登录 → 一对一推送</div>
              </div>
            )}
            <div className="settings-divider" />
            <div className="settings-logout" onClick={() => { setSettingsOpen(false); signOut(); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>退出登录</div>
          </div>
          <button className="settings-btn" onClick={() => setSettingsOpen(o => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="nav-label">设置</span>
          </button>
        </div>
        </div>
      </aside>

      <main className={`main ${sidebarExpanded ? 'pushed' : ''}`}>
        {isMobile && <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="菜单"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>}
        <Routes>
          <Route path="/" element={<TasksPage tasks={tasks} taskTypes={taskTypes} activeTasks={activeTasks} completedTasks={completedTasks} trashTasks={trashTasks} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} restoreTask={restoreTask} permanentDelete={permanentDelete} toggleComplete={toggleComplete} addTaskType={addTaskType} deleteTaskType={deleteTaskType} refresh={refresh} getSubtasks={getSubtasks} addSubtask={addSubtask} toggleSubtask={toggleSubtask} deleteSubtask={deleteSubtask} openNew={openNew} openEdit={openEdit} getTypeName={getTypeName} getTypeColor={getTypeColor} pushplusToken={pushplusToken} />} />
          <Route path="/analytics" element={<AnalyticsPage activeTasks={activeTasks} completedTasks={completedTasks} />} />
          <Route path="/chat" element={<AIChat tasks={tasks} taskTypes={taskTypes} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} toggleComplete={toggleComplete} refresh={refresh} />} />
          <Route path="/toolbox" element={<ToolboxPage />} />
          <Route path="/import" element={<ImportPage tasks={tasks} taskTypes={taskTypes} addTask={addTask} getTypeName={getTypeName} handleImport={handleImport} handleStoragePull={handleStoragePull} />} />
          <Route path="/task/:taskId" element={<TaskDetailWrapper tasks={tasks} isMobile={isMobile} pushplusToken={pushplusToken} />} />
        </Routes>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>{editingTask ? "编辑任务" : "新建任务"}</h3>
              <form onSubmit={handleSubmit}>
                <label>任务名称</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="输入任务名称" />
                <div className="form-row">
                  <div><label>类型</label><select value={form.typeId} onChange={e => setForm({ ...form, typeId: e.target.value })}><option value="">无分类</option>{taskTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div><label>优先级</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></div>
                </div>
                <div className="form-row">
                  <div><label>开始</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
                  <div><label>截止</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
                </div>
                <div className="form-row">
                  <div><label>重复</label><select value={form.repeatRule} onChange={e => setForm({ ...form, repeatRule: e.target.value })}><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option></select></div>
                  <div><label>提醒</label><input type="datetime-local" value={form.reminderAt} onChange={e => setForm({ ...form, reminderAt: e.target.value })} /></div>
                </div>
                <label>备注</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="可选备注" rows={2} />
                <div className="form-actions"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button><button type="submit" className="btn-primary">{editingTask ? "保存" : "创建"}</button></div>
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
