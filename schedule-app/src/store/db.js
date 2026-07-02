import Dexie from 'dexie';

const db = new Dexie('ScheduleDB');

// v3: add subtasks, repeatRule, completedAt
// v2: add priority, reminderAt, notified
// v1: initial

db.version(3).stores({
  taskTypes: '++id, name, color',
  tasks: '++id, typeId, title, startDate, endDate, source, completed, createdAt, reminderAt, notified, priority, completedAt, repeatRule',
  subtasks: '++id, taskId, title, completed, createdAt',
});

db.version(2).stores({
  taskTypes: '++id, name, color',
  tasks: '++id, typeId, title, startDate, endDate, source, completed, createdAt, reminderAt, notified',
});

db.version(1).stores({
  taskTypes: '++id, name, color',
  tasks: '++id, typeId, title, startDate, endDate, source, completed, createdAt',
});

export default db;
