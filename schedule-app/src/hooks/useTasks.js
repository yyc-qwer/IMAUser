import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import { sortByUrgency, beijingISO } from '../utils/dateUtils';
import { DEFAULT_TASK_TYPES } from '../utils/defaultTypes';

// ===== Snake/Camel case helpers =====
function toSnakeCase(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snake] = toSnakeCase(obj[key]);
    }
  }
  return result;
}

function toCamelCase(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camel] = toCamelCase(obj[key]);
    }
  }
  return result;
}

function mapToCamelCase(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => toCamelCase(item));
}

// ===== Notification helpers =====
const NOTIF_KEY = 'schedule_notif_enabled';
export function isNotificationEnabled() { return localStorage.getItem(NOTIF_KEY) === 'true'; }
export function setNotificationEnabled(v) { localStorage.setItem(NOTIF_KEY, v ? 'true' : 'false'); }
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleTaskNotification(task) {
  if (!task.reminderAt || task.notified || task.completed) return;
  const reminderTime = new Date(task.reminderAt).getTime();
  const now = Date.now();
  const delay = reminderTime - now;
  if (delay <= 0) return;
  setTimeout(async () => {
    const { data: current } = await supabase.from('tasks').select('*').eq('id', task.id).eq('user_id', task.userId).single();
    if (!current || current.completed || current.notified) return;
    if (Notification.permission === 'granted') {
      new Notification('日程提醒', { body: `任务 "${current.title}" 的提醒时间到了`, icon: '/icon128.png', tag: `task-${current.id}` });
    }
    await supabase.from('tasks').update({ notified: true }).eq('id', current.id);
  }, delay);
}

async function rescheduleAllNotifications(userId) {
  if (!isNotificationEnabled() || Notification.permission !== 'granted' || !userId) return;
  const { data } = await supabase.from('tasks').select('*').eq('user_id', userId);
  (mapToCamelCase(data || [])).forEach(t => scheduleTaskNotification(t));
}

// ===== Repeat task helper =====
const REPEAT_CHECK_KEY = 'schedule_repeat_last_check';
export async function processRepeatTasks(currentUser) {
  const lastCheck = localStorage.getItem(REPEAT_CHECK_KEY);
  const now = new Date(); const todayStr = now.toISOString().slice(0, 10);
  if (lastCheck === todayStr) return;
  if (!currentUser?.id) return;
  const { data: taskData } = await supabase.from('tasks').select('*').eq('user_id', currentUser.id);
  const tasks = mapToCamelCase(taskData || []);
  for (const task of tasks) {
    if (!task.repeatRule || task.repeatRule === 'none' || !task.completed) continue;
    const lastDate = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
    const daysSince = Math.floor((now - lastDate) / (24 * 60 * 60 * 1000));
    let shouldCreate = false;
    if (task.repeatRule === 'daily' && daysSince >= 1) shouldCreate = true;
    if (task.repeatRule === 'weekly' && daysSince >= 7) shouldCreate = true;
    if (shouldCreate) {
      const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('title', task.title).eq('completed', false).ilike('created_at', `${todayStr}%`);
      if (count === 0) {
        await supabase.from('tasks').insert(toSnakeCase({ userId: currentUser?.id, title: task.title, typeId: task.typeId, startDate: null, endDate: task.endDate, notes: task.notes, priority: task.priority || 'medium', source: task.source || 'manual', completed: false, notified: false, reminderAt: task.reminderAt, repeatRule: task.repeatRule, createdAt: beijingISO() }));
      }
    }
  }
  localStorage.setItem(REPEAT_CHECK_KEY, todayStr);
}

// ===== Trash helper =====
const TRASH_KEY = 'ima_trash_tasks';

function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'); } catch { return []; }
}
function saveTrash(arr) { localStorage.setItem(TRASH_KEY, JSON.stringify(arr)); }

function useTrash() {
  const [trash, setTrash] = useState(loadTrash);
  const addToTrash = (task) => {
    const updated = [...trash, task];
    setTrash(updated); saveTrash(updated);
  };
  const removeFromTrash = (id) => {
    const updated = trash.filter(t => t.id !== id);
    setTrash(updated); saveTrash(updated);
  };
  return { trash, addToTrash, removeFromTrash, setTrash };
}

// ===== Main Hook =====
export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { trash: trashTasks, addToTrash, removeFromTrash, setTrash } = useTrash();

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: taskData, error: taskError } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (taskError) console.error('fetch tasks error:', taskError);
    const { data: typeData, error: typeError } = await supabase.from('task_types').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (typeError) console.error('fetch types error:', typeError);
    // 不在 refresh 中过滤删除 — 删除由 deleteTask 立即从 tasks 中移除
    setTasks(sortByUrgency(mapToCamelCase(taskData || [])));
    const types = mapToCamelCase(typeData || []);
    setTaskTypes(types);
    // 初始化默认类型
    if (types.length === 0) {
      for (const t of DEFAULT_TASK_TYPES) {
        await supabase.from('task_types').insert({ user_id: user.id, name: t.name, color: t.color });
      }
      // 重新获取
      const { data: newTypes } = await supabase.from('task_types').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (newTypes) setTaskTypes(mapToCamelCase(newTypes));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') refresh();
      if (event === 'SIGNED_OUT') { setTasks([]); setTaskTypes([]); setTrash([]); setLoading(false); }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [refresh, setTrash]);
  useEffect(() => { rescheduleAllNotifications(user?.id); processRepeatTasks(user); }, [user]);

  const addTask = async (task) => {
    if (!user) return null;
    const normalizeDate = (d) => { if (!d) return null; if (typeof d === 'string' && d.includes('T')) return d; return d + 'T23:59:59+08:00'; };
    const payload = toSnakeCase({ ...task, userId: user.id, completed: false, notified: false, startDate: normalizeDate(task.startDate), endDate: normalizeDate(task.endDate), createdAt: beijingISO() });
    const { data, error } = await supabase.from('tasks').insert(payload).select().single();
    if (error) { console.error('add task error:', error); return null; }
    const inserted = toCamelCase(data);
    if (isNotificationEnabled()) scheduleTaskNotification(inserted);
    setTasks(prev => sortByUrgency([inserted, ...prev]));
    return inserted.id;
  };

  const updateTask = async (id, updates) => {
    const normalizeDate = (d) => { if (!d) return null; if (typeof d === 'string' && d.includes('T')) return d; return d + 'T23:59:59+08:00'; };
    const normalized = { ...updates };
    if (normalized.startDate) normalized.startDate = normalizeDate(normalized.startDate);
    if (normalized.endDate) normalized.endDate = normalizeDate(normalized.endDate);
    setTasks(prev => sortByUrgency(prev.map(t => t.id === id ? { ...t, ...normalized } : t)));
    const { data, error } = await supabase.from('tasks').update(toSnakeCase(normalized)).eq('id', id).select().single();
    if (error) { console.error('update task error:', error); return; }
    if (isNotificationEnabled()) scheduleTaskNotification(toCamelCase(data));
  };

  const deleteTask = async (id) => {
    const target = tasks.find(t => t.id === id);
    if (target) addToTrash(target);
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const restoreTask = async (id) => {
    const target = trashTasks.find(t => t.id === id);
    if (target) {
      const { userId, ...rest } = target;
      setTasks(prev => sortByUrgency([toCamelCase({ ...rest, userId }), ...prev]));
      await supabase.from('tasks').insert(toSnakeCase({ ...rest, userId }));
    }
    removeFromTrash(id);
  };

  const permanentDelete = async (id) => {
    removeFromTrash(id);
    await supabase.from('tasks').delete().eq('id', id);
  };

  const toggleComplete = async (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? beijingISO() : null } : t));
    try {
      const { data: task } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (!task) return;
      const newCompleted = !task.completed;
      await supabase.from('tasks').update({ completed: newCompleted, completed_at: newCompleted ? beijingISO() : null }).eq('id', id);
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? null : beijingISO() } : t));
    }
  };

  const addTaskType = async (type) => {
    if (!user) return;
    const { error } = await supabase.from('task_types').insert(toSnakeCase({ ...type, userId: user.id }));
    if (error) { console.error('[addTaskType]', error.message); throw error; }
    await refresh();
  };

  const deleteTaskType = async (id) => {
    setTaskTypes(prev => prev.filter(t => t.id !== id));
    await supabase.from('task_types').delete().eq('id', id);
  };

  const getSubtasks = async (taskId) => {
    const { data, error } = await supabase.from('subtasks').select('*').eq('task_id', taskId).order('id', { ascending: true });
    if (error) { console.error('fetch subtasks error:', error); return []; }
    return mapToCamelCase(data || []);
  };
  const addSubtask = async (taskId, title) => { await supabase.from('subtasks').insert({ task_id: taskId, title, completed: false, created_at: beijingISO() }); };
  const toggleSubtask = async (subtaskId) => {
    const { data } = await supabase.from('subtasks').select('completed').eq('id', subtaskId).single();
    if (data) await supabase.from('subtasks').update({ completed: !data.completed }).eq('id', subtaskId);
  };
  const deleteSubtask = async (subtaskId) => { await supabase.from('subtasks').delete().eq('id', subtaskId); };

  const getWeeklyStats = useCallback(() => {
    const now = new Date(); const stats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); const dateStr = d.toISOString().slice(0, 10);
      stats.push({ date: dateStr, label: `${d.getMonth() + 1}/${d.getDate()}`, completed: tasks.filter(t => t.completed && t.completedAt && t.completedAt.startsWith(dateStr)).length, created: tasks.filter(t => t.createdAt && t.createdAt.startsWith(dateStr)).length });
    }
    return stats;
  }, [tasks]);

  const projectTypeId = taskTypes.find(t => t.name === '项目')?.id;
  const activeTasks = tasks.filter(t => !t.completed && t.typeId !== projectTypeId);
  const completedTasks = tasks.filter(t => t.completed && t.typeId !== projectTypeId);

  return { tasks, taskTypes, loading, activeTasks, completedTasks, trashTasks, addTask, updateTask, deleteTask, restoreTask, permanentDelete, toggleComplete, addTaskType, deleteTaskType, refresh, getSubtasks, addSubtask, toggleSubtask, deleteSubtask, getWeeklyStats };
}
