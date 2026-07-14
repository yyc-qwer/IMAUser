/**
 * Compute days between two dates. Positive = future, negative = past.
 */
export function daysBetween(a, b) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b) - new Date(a)) / oneDay);
}

/**
 * Format a countdown/up string in Chinese.
 */
export function formatCountdown(task) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = task.startDate ? new Date(task.startDate) : null;
  const end = task.endDate ? new Date(task.endDate) : null;

  if (end) {
    end.setHours(0, 0, 0, 0);
    const days = daysBetween(now, end);
    if (days > 0) return { text: `距离结束还有${days}天`, urgent: days <= 3, type: "end" };
    if (days === 0) return { text: "今天截止", urgent: true, type: "end" };
    return { text: `已结束${-days}天`, urgent: false, type: "end-past" };
  }

  if (start) {
    start.setHours(0, 0, 0, 0);
    const days = daysBetween(start, now);
    if (days > 0) return { text: `已开始${days}天`, urgent: false, type: "start" };
    if (days === 0) return { text: "今天开始", urgent: true, type: "start" };
    return { text: `距离开始还有${-days}天`, urgent: false, type: "start-future" };
  }

  return { text: "未设置日期", urgent: false, type: "none" };
}

/**
 * Sort tasks: nearest end date first, then by urgency.
 */
export function sortByUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const aDays = a.endDate ? daysBetween(now, new Date(a.endDate)) : Infinity;
    const bDays = b.endDate ? daysBetween(now, new Date(b.endDate)) : Infinity;
    if (aDays !== bDays) return aDays - bDays;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });
}

/**
 * Format date to zh-CN locale string.
 * 正确处理带/不带时区的各种日期格式
 */
export function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}