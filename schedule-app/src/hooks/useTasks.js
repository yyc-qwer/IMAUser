import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';
import { sortByUrgency } from '../utils/dateUtils';

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

export function isNotificationEnabled() {
  return localStorage.getItem(NOTIF_KEY) === 'true';
}

export function setNotificationEnabled(v) {
  localStorage.setItem(NOTIF_KEY, v ? 'true' : 'false');
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Schedule a notification for a task
export function scheduleTaskNotification(task) {
  if (!task.reminderAt || task.notified || task.completed) return;
  const reminderTime = new Date(task.reminderAt).getTime();
  const now = Date.now();
  const delay = reminderTime - now;
  if (delay <= 0) return;

  setTimeout(async () => {
    const { data: current } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', task.id)
      .eq('user_id', task.userId)
      .single();
    if (!current || current.completed || current.notified) return;
    if (Notification.permission === 'granted') {
      new Notification('日程提醒', {
        body: `任务 "${current.title}" 的提醒时间到了`,
        icon: '/icon128.png',
        tag: `task-${current.id}`,
      });
    }
    await supabase.from('tasks').update({ notified: true }).eq('id', current.id);
  }, delay);
}

async function rescheduleAllNotifications(userId) {
  if (!isNotificationEnabled() || Notification.permission !== 'granted') return;
  if (!userId) return;
  const { data } = await supabase.from('tasks').select('*').eq('user_id', userId);
  const tasks = mapToCamelCase(data || []);
  tasks.forEach(t => scheduleTaskNotification(t));
}

// ===== Repeat task helper =====
const REPEAT_CHECK_KEY = 'schedule_repeat_last_check';

export async function processRepeatTasks(currentUser) {
  const lastCheck = localStorage.getItem(REPEAT_CHECK_KEY);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (lastCheck === todayStr) return;

  if (!currentUser?.id) return;
  const { data: taskData } = await supabase.from('tasks').select('*').eq('user_id', currentUser.id);
  const tasks = mapToCamelCase(taskData || []);

  for (const task of tasks) {
    if (!task.repeatRule || task.repeatRule === 'none') continue;
    if (!task.completed) continue;

    const lastDate = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
    const daysSince = Math.floor((now - lastDate) / (24 * 60 * 60 * 1000));

    let shouldCreate = false;
    if (task.repeatRule === 'daily' && daysSince >= 1) shouldCreate = true;
    if (task.repeatRule === 'weekly' && daysSince >= 7) shouldCreate = true;

    if (shouldCreate) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('title', task.title)
        .eq('completed', false)
        .ilike('created_at', `${todayStr}%`);

      if (count === 0) {
        await supabase.from('tasks').insert(toSnakeCase({
          userId: currentUser?.id,
          title: task.title,
          typeId: task.typeId,
          startDate: null,
          endDate: task.endDate,
          notes: task.notes,
          priority: task.priority || 'medium',
          source: task.source || 'manual',
          completed: false,
          notified: false,
          reminderAt: task.reminderAt,
          repeatRule: task.repeatRule,
          createdAt: new Date().toISOString(),
        }));
      }
    }
  }

  localStorage.setItem(REPEAT_CHECK_KEY, todayStr);
}

// ===== Advanced Stats Helpers =====

export function calcProcrastinationIndex(tasks) {
  const tasksWithDeadline = tasks.filter(t => t.completed && t.endDate);
  if (tasksWithDeadline.length === 0) return null;

  let onTimeCount = 0;
  let totalAdvanceDays = 0;

  tasksWithDeadline.forEach(t => {
    const deadline = new Date(t.endDate);
    const completed = new Date(t.completedAt);
    const daysDiff = (deadline - completed) / (24 * 60 * 60 * 1000);
    if (daysDiff >= 0) onTimeCount++;
    totalAdvanceDays += daysDiff;
  });

  const onTimeRate = onTimeCount / tasksWithDeadline.length;
  const avgAdvance = totalAdvanceDays / tasksWithDeadline.length;

  let score = onTimeRate * 60;
  if (avgAdvance >= 3) score += 40;
  else if (avgAdvance >= 1) score += 30;
  else if (avgAdvance >= 0) score += 20;
  else if (avgAdvance >= -1) score += 10;
  else score += 0;

  return Math.round(score);
}

export function getDeadlinePressure(tasks) {
  const now = new Date();
  const result = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = tasks.filter(t =>
      !t.completed && t.endDate && t.endDate.startsWith(dateStr)
    ).length;
    result.push({
      date: dateStr,
      label: i === 0 ? '今天' : i === 1 ? '明天' : `${d.getMonth() + 1}/${d.getDate()}`,
      count,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return result;
}

export function getStreakData(tasks) {
  const now = new Date();
  const days = [];
  for (let i = 179; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const completed = tasks.filter(t =>
      t.completed && t.completedAt && t.completedAt.startsWith(dateStr)
    ).length;
    days.push({ date: dateStr, count: completed });
  }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak++;
    else break;
  }

  let maxStreak = 0;
  let tempStreak = 0;
  days.forEach(d => {
    if (d.count > 0) { tempStreak++; maxStreak = Math.max(maxStreak, tempStreak); }
    else tempStreak = 0;
  });

  return { days, currentStreak, maxStreak };
}

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (taskError) console.error('fetch tasks error:', taskError);

    const { data: typeData, error: typeError } = await supabase
      .from('task_types')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (typeError) console.error('fetch types error:', typeError);

    setTasks(sortByUrgency(mapToCamelCase(taskData || [])));
    setTaskTypes(mapToCamelCase(typeData || []));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') refresh();
      if (event === 'SIGNED_OUT') {
        setTasks([]);
        setTaskTypes([]);
        setLoading(false);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    rescheduleAllNotifications(user?.id);
    processRepeatTasks(user);
  }, [user]);

  const addTask = async (task) => {
    if (!user) return null;
    // 统一日期格式：纯日期字符串存为当地日期的末尾时间（避免 timestamptz 时区偏移）
    const normalizeDate = (d) => {
      if (!d) return null;
      // 已经是完整 ISO 时间戳则保留，否则视为纯日期（补上当天结束时间）
      if (typeof d === 'string' && d.includes('T')) return d;
      return d + 'T23:59:59';
    };
    const payload = toSnakeCase({
      ...task,
      userId: user.id,
      completed: false,
      notified: false,
      startDate: normalizeDate(task.startDate),
      endDate: normalizeDate(task.endDate),
      createdAt: new Date().toISOString(),
    });
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('add task error:', error);
      return null;
    }
    const inserted = toCamelCase(data);
    if (isNotificationEnabled()) scheduleTaskNotification(inserted);
    await refresh();
    return inserted.id;
  };

  const updateTask = async (id, updates) => {
    // 统一日期格式
    const normalizeDate = (d) => {
      if (!d) return null;
      if (typeof d === 'string' && d.includes('T')) return d;
      return d + 'T23:59:59';
    };
    const normalized = { ...updates };
    if (normalized.startDate) normalized.startDate = normalizeDate(normalized.startDate);
    if (normalized.endDate) normalized.endDate = normalizeDate(normalized.endDate);
    const payload = toSnakeCase(normalized);
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('update task error:', error);
      return;
    }
    const updated = toCamelCase(data);
    if (isNotificationEnabled()) scheduleTaskNotification(updated);
    await refresh();
  };

  const deleteTask = async (id) => {
    await supabase.from('subtasks').delete().eq('task_id', id);
    await supabase.from('tasks').delete().eq('id', id);
    await refresh();
  };

  const toggleComplete = async (id) => {
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (!task) return;
    const newCompleted = !task.completed;
    await supabase.from('tasks').update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    }).eq('id', id);
    await refresh();
  };

  const addTaskType = async (type) => {
    if (!user) return;
    await supabase.from('task_types').insert(toSnakeCase({
      ...type,
      userId: user.id,
      createdAt: new Date().toISOString(),
    }));
    await refresh();
  };

  const deleteTaskType = async (id) => {
    await supabase.from('task_types').delete().eq('id', id);
    await refresh();
  };

  // ===== Subtask operations =====
  const getSubtasks = async (taskId) => {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('id', { ascending: true });
    if (error) {
      console.error('fetch subtasks error:', error);
      return [];
    }
    return mapToCamelCase(data || []);
  };

  const addSubtask = async (taskId, title) => {
    await supabase.from('subtasks').insert({
      task_id: taskId,
      title,
      completed: false,
      created_at: new Date().toISOString(),
    });
  };

  const toggleSubtask = async (subtaskId) => {
    const { data } = await supabase
      .from('subtasks')
      .select('completed')
      .eq('id', subtaskId)
      .single();
    if (!data) return;
    await supabase.from('subtasks').update({ completed: !data.completed }).eq('id', subtaskId);
  };

  const deleteSubtask = async (subtaskId) => {
    await supabase.from('subtasks').delete().eq('id', subtaskId);
  };

  // ===== Stats =====
  const getWeeklyStats = useCallback(() => {
    const now = new Date();
    const stats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const completed = tasks.filter(t =>
        t.completed && t.completedAt && t.completedAt.startsWith(dateStr)
      ).length;
      const created = tasks.filter(t =>
        t.createdAt && t.createdAt.startsWith(dateStr)
      ).length;
      stats.push({
        date: dateStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        completed,
        created,
      });
    }
    return stats;
  }, [tasks]);

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return {
    tasks, taskTypes, loading, activeTasks, completedTasks,
    addTask, updateTask, deleteTask, toggleComplete,
    addTaskType, deleteTaskType, refresh,
    getSubtasks, addSubtask, toggleSubtask, deleteSubtask,
    getWeeklyStats,
  };
}
