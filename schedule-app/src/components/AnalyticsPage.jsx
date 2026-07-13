import { calcProcrastinationIndex, getDeadlinePressure, getStreakData } from "../hooks/useTasks";

export default function AnalyticsPage({ tasks, activeTasks, completedTasks, taskTypes, weeklyStats, maxWeeklyCompleted, maxWeeklyCreated, sortedMonths, maxCount, typeDistribution, maxTypeCount, priorityCount }) {
  const procrastinationIndex = calcProcrastinationIndex(tasks);
  const deadlinePressure = getDeadlinePressure(tasks);
  const streakData = getStreakData(tasks);

  const maxPressure = Math.max(1, ...deadlinePressure.map(d => d.count));
  const upcomingDeadlines = deadlinePressure.filter(d => d.count > 0);
  const highPressureDays = deadlinePressure.filter(d => d.count >= 3);

  const getStreakColor = (count) => {
    if (count === 0) return 'var(--surface2)';
    if (count === 1) return '#0e4429';
    if (count === 2) return '#006d32';
    if (count <= 4) return '#26a641';
    return '#39d353';
  };

  const weeks = [];
  for (let i = 0; i < streakData.days.length; i += 7) {
    weeks.push(streakData.days.slice(i, i + 7));
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <>
      <header className="main-header"><h2>数据分析</h2></header>
      <div className="analytics-grid">

        {/* 拖延指数 */}
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
              <p className="procrastination-hint">基于已完成的任务中，准时完成率和平均提前天数计算</p>
            </div>
          )}
        </div>

        {/* Deadline 压力 */}
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

        {/* 连续打卡日历 */}
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

        {/* 近7日完成情况 */}
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

        {/* 每月任务分布 */}
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

        {/* 按类型统计 */}
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

        {/* 优先级分布 */}
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

        {/* 总览 */}
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
