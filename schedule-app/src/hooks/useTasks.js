import { useState, useEffect, useCallback } from 'react';
import db from '../store/db';
import { sortByUrgency } from '../utils/dateUtils';

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
    const current = await db.tasks.get(task.id);
    if (!current || current.completed || current.notified) return;
    if (Notification.permission === 'granted') {
      new Notification('日程提醒', {
        body: `任务 "${current.title}" 的提醒时间到了`,
        icon: '/icon128.png',
        tag: `task-${current.id}`,
      });
    }
    await db.tasks.update(current.id, { notified: true });
  }, delay);
}

async function rescheduleAllNotifications() {
  if (!isNotificationEnabled() || Notification.permission !== 'granted') return;
  const tasks = await db.tasks.toArray();
  tasks.forEach(t => scheduleTaskNotification(t));
}

// ===== Repeat task helper =====
const REPEAT_CHECK_KEY = 'schedule_repeat_last_check';

export async function processRepeatTasks() {
  const lastCheck = localStorage.getItem(REPEAT_CHECK_KEY);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (lastCheck === todayStr) return;

  const tasks = await db.tasks.toArray();
  for (const task of tasks) {
    if (!task.repeatRule || task.repeatRule === 'none') continue;
    if (!task.completed) continue;

    const lastDate = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
    const daysSince = Math.floor((now - lastDate) / (24 * 60 * 60 * 1000));

    let shouldCreate = false;
    if (task.repeatRule === 'daily' && daysSince >= 1) shouldCreate = true;
    if (task.repeatRule === 'weekly' && daysSince >= 7) shouldCreate = true;

    if (shouldCreate) {
      const existing = await db.tasks
        .where('title')
        .equals(task.title)
        .and(t => !t.completed && t.createdAt && t.createdAt.startsWith(todayStr))
        .count();

      if (existing === 0) {
        await db.tasks.add({
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
        });
      }
    }
  }

  localStorage.setItem(REPEAT_CHECK_KEY, todayStr);
}

// ===== Advanced Stats Helpers =====

// 拖延指数: 0-100, 越低越好
// 基于: 有截止日期的已完成任务中，提前完成的比例和平均提前天数
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

  // 指数计算: 准时率占60%, 平均提前天数占40%
  // avgAdvance 越大越好(提前多), 负数表示拖后
  let score = onTimeRate * 60;
  if (avgAdvance >= 3) score += 40;
  else if (avgAdvance >= 1) score += 30;
  else if (avgAdvance >= 0) score += 20;
  else if (avgAdvance >= -1) score += 10;
  else score += 0;

  return Math.round(score);
}

// 未来30天 deadline 压力分布
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

// 连续打卡天数 (GitHub风格)
export function getStreakData(tasks) {
  const now = new Date();
  const days = [];
  // 过去 180 天 (约6个月)
  for (let i = 179; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const completed = tasks.filter(t =>
      t.completed && t.completedAt && t.completedAt.startsWith(dateStr)
    ).length;
    days.push({ date: dateStr, count: completed });
  }

  // 计算当前连续打卡天数
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak++;
    else break;
  }

  // 计算最长连续打卡
  let maxStreak = 0;
  let tempStreak = 0;
  days.forEach(d => {
    if (d.count > 0) { tempStreak++; maxStreak = Math.max(maxStreak, tempStreak); }
    else tempStreak = 0;
  });

  return { days, currentStreak, maxStreak };
}

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await db.tasks.toArray();
    setTasks(sortByUrgency(t));
    const types = await db.taskTypes.toArray();
    setTaskTypes(types);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    rescheduleAllNotifications();
    processRepeatTasks();
  }, []);

  const addTask = async (task) => {
    const id = await db.tasks.add({
      ...task,
      completed: false,
      notified: false,
      createdAt: new Date().toISOString(),
    });
    const inserted = await db.tasks.get(id);
    if (isNotificationEnabled()) scheduleTaskNotification(inserted);
    await refresh();
    return id;
  };

  const updateTask = async (id, updates) => {
    await db.tasks.update(id, updates);
    const updated = await db.tasks.get(id);
    if (isNotificationEnabled()) scheduleTaskNotification(updated);
    await refresh();
  };

  const deleteTask = async (id) => {
    await db.tasks.delete(id);
    await db.subtasks.where('taskId').equals(id).delete();
    await refresh();
  };

  const toggleComplete = async (id) => {
    const task = await db.tasks.get(id);
    const newCompleted = !task.completed;
    await db.tasks.update(id, {
      completed: newCompleted,
      completedAt: newCompleted ? new Date().toISOString() : null,
    });
    await refresh();
  };

  const addTaskType = async (type) => {
    await db.taskTypes.add(type);
    await refresh();
  };

  const deleteTaskType = async (id) => {
    await db.taskTypes.delete(id);
    await refresh();
  };

  // ===== Subtask operations =====
  const getSubtasks = async (taskId) => {
    return await db.subtasks.where('taskId').equals(taskId).sortBy('id');
  };

  const addSubtask = async (taskId, title) => {
    await db.subtasks.add({
      taskId,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  };

  const toggleSubtask = async (subtaskId) => {
    const st = await db.subtasks.get(subtaskId);
    await db.subtasks.update(subtaskId, { completed: !st.completed });
  };

  const deleteSubtask = async (subtaskId) => {
    await db.subtasks.delete(subtaskId);
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
