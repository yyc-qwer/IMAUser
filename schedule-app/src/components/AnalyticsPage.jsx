export default function AnalyticsPage({ tasks, activeTasks, completedTasks, taskTypes, weeklyStats, maxWeeklyCompleted, maxWeeklyCreated, typeDistribution }) {
  const total = activeTasks.length + completedTasks.length;
  const completionRate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

  // 饼图数据
  const pieData = Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]);
  const pieColors = ["#58a6ff", "#3fb950", "#f0883e", "#d29922", "#f85149", "#a371f7", "#8b949e", "#79c0ff"];
  let cumulative = 0;
  const pieSlices = pieData.map(([name, count], i) => {
    const pct = Math.round((count / Math.max(1, activeTasks.length)) * 100);
    const start = cumulative;
    cumulative += pct;
    return { name, count, pct, start, end: cumulative, color: pieColors[i % pieColors.length] };
  });

  return (
    <>
      <header className="main-header"><h2>数据分析</h2></header>
      <div className="analytics-grid">

        {/* 总览 */}
        <div className="chart-card summary-card">
          <h4>总览</h4>
          <div className="summary-grid">
            <div className="summary-item"><span className="sum-val">{total}</span><span className="sum-label">总任务数</span></div>
            <div className="summary-item"><span className="sum-val">{activeTasks.length}</span><span className="sum-label">进行中</span></div>
            <div className="summary-item"><span className="sum-val">{completedTasks.length}</span><span className="sum-label">已完成</span></div>
            <div className="summary-item"><span className="sum-val">{completionRate}%</span><span className="sum-label">完成率</span></div>
          </div>
        </div>

        {/* 饼图 — 按类型分布 */}
        <div className="chart-card">
          <h4>按类型分布</h4>
          {pieSlices.length === 0 ? <div className="empty">暂无数据</div> : (
            <div className="pie-chart-wrapper">
              <svg viewBox="0 0 180 180" className="pie-svg">
                {pieSlices.map((slice, i) => {
                  const startAngle = (slice.start / 100) * 360;
                  const endAngle = (slice.end / 100) * 360;
                  const x1 = 90 + 70 * Math.cos((startAngle - 90) * Math.PI / 180);
                  const y1 = 90 + 70 * Math.sin((startAngle - 90) * Math.PI / 180);
                  const x2 = 90 + 70 * Math.cos((endAngle - 90) * Math.PI / 180);
                  const y2 = 90 + 70 * Math.sin((endAngle - 90) * Math.PI / 180);
                  const large = (endAngle - startAngle) > 180 ? 1 : 0;
                  return (
                    <path key={i} d={`M90 90 L${x1} ${y1} A70 70 0 ${large} 1 ${x2} ${y2} Z`}
                      fill={slice.color} stroke="var(--bg)" strokeWidth="2">
                      <title>{slice.name}: {slice.count} 个 ({slice.pct}%)</title>
                    </path>
                  );
                })}
              </svg>
              <div className="pie-legend">
                {pieSlices.map((s, i) => (
                  <div key={i} className="pie-legend-item">
                    <span className="pie-legend-dot" style={{ background: s.color }} />
                    <span>{s.name}</span>
                    <span className="pie-legend-count">{s.count} ({s.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
      </div>
    </>
  );
}
