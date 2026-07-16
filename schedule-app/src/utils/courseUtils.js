/**
 * 解析周次字符串，返回有效的周次数组
 * 支持格式："1-16周", "4-8双周", "单周", "1-8,10-16周", "第3周"
 */
export function parseWeeks(classTime, maxWeeks = 20) {
  if (!classTime) return [];

  const text = String(classTime).replace(/周/g, '').replace(/第/g, '').trim();
  const weeks = new Set();

  const parts = text.split(/[,，]/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 匹配 "X-Y双" 或 "X-Y单"
    const sdMatch = trimmed.match(/^(\d+)-(\d+)([单双])$/);
    if (sdMatch) {
      const [, start, end, type] = sdMatch;
      for (let w = parseInt(start); w <= parseInt(end); w++) {
        if (type === '单' && w % 2 === 1) weeks.add(w);
        if (type === '双' && w % 2 === 0) weeks.add(w);
      }
      continue;
    }

    // 匹配 "X-Y" 范围
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, start, end] = rangeMatch;
      for (let w = parseInt(start); w <= parseInt(end); w++) {
        weeks.add(w);
      }
      continue;
    }

    // 匹配纯数字
    const numMatch = trimmed.match(/^(\d+)$/);
    if (numMatch) {
      weeks.add(parseInt(numMatch[1]));
      continue;
    }

    // 全局单双周
    if (trimmed === '单') {
      for (let w = 1; w <= maxWeeks; w += 2) weeks.add(w);
      continue;
    }
    if (trimmed === '双') {
      for (let w = 2; w <= maxWeeks; w += 2) weeks.add(w);
      continue;
    }
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * 根据学期第一天、周次、星期几，计算具体日期
 * semesterStart: "2025-02-24"
 * week: 1
 * weekday: "周一"
 */
export function getCourseDate(semesterStart, week, weekday) {
  const start = new Date(semesterStart + 'T00:00:00');
  const weekdayMap = { "周一": 0, "周二": 1, "周三": 2, "周四": 3, "周五": 4, "周六": 5, "周日": 6 };
  const offset = weekdayMap[weekday];
  if (offset === undefined) return null;

  const date = new Date(start);
  date.setDate(date.getDate() + (week - 1) * 7 + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * 默认节次时间映射（可根据学校调整）
 */
export const PERIOD_TIME = {
  "第1节": { start: "08:00", end: "08:45" },
  "第2节": { start: "08:50", end: "09:35" },
  "第3节": { start: "10:00", end: "10:45" },
  "第4节": { start: "10:50", end: "11:35" },
  "第5节": { start: "14:00", end: "14:45" },
  "第6节": { start: "14:50", end: "15:35" },
  "第7节": { start: "15:40", end: "16:25" },
  "第8节": { start: "16:30", end: "17:15" },
  "第9节": { start: "19:00", end: "19:45" },
  "第10节": { start: "19:50", end: "20:35" },
  "第11节": { start: "20:40", end: "21:25" },
};

/**
 * 将爬虫抓取的课程数据转换为任务对象数组
 */
export function coursesToTasks(courses, semesterStart) {
  const tasks = [];

  for (const c of courses) {
    const weeks = parseWeeks(c.classTime);
    const timeInfo = PERIOD_TIME[c.period] || { start: "08:00", end: "08:45" };
    const timeStr = `${timeInfo.start}-${timeInfo.end}`;
    const noteParts = [];
    if (c.teacher) noteParts.push(c.teacher);
    if (c.location) noteParts.push(c.location);
    if (c.period) noteParts.push(c.period);
    if (timeStr) noteParts.push(timeStr);

    for (const week of weeks) {
      const date = getCourseDate(semesterStart, week, c.weekday);
      if (!date) continue;

      tasks.push({
        title: c.courseName,
        startDate: date,
        endDate: date,
        notes: noteParts.join(' | '),
        priority: 'medium',
        source: 'course',
      });
    }
  }

  return tasks;
}
