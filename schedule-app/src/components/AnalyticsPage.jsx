export default function AnalyticsPage({ activeTasks, completedTasks }) {
  const total = activeTasks.length + completedTasks.length;
  const completionRate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

  // 饼图 — 完成 vs 未完成
  const slices = [
    { label: '已完成', count: completedTasks.length, color: '#2f81f7', pct: completionRate },
    { label: '进行中', count: activeTasks.length, color: '#58a6ff', pct: 100 - completionRate },
  ].filter(s => s.count > 0);

  // SVG donut
  const r = 40, cxy = 42, circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcPaths = slices.map((s, i) => {
    const dashLen = (s.pct / 100) * circumference;
    const dashOffset = circumference - offset;
    offset += dashLen;
    return { ...s, dashLen, dashOffset, i };
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

        {/* 完成率饼图 */}
        <div className="chart-card">
          <h4>完成率</h4>
          {total === 0 ? <div className="empty">暂无数据</div> : (
            <div className="donut-wrapper">
              <svg viewBox="0 0 84 84" className="donut-svg" style={{ width: 160, height: 160 }}>
                <circle cx={cxy} cy={cxy} r={r} fill="none" stroke="var(--surface2)" strokeWidth="12" />
                {arcPaths.map(({ color, dashLen, dashOffset, i }) => (
                  <circle key={i} cx={cxy} cy={cxy} r={r} fill="none" stroke={color} strokeWidth="12"
                    strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                    strokeDashoffset={circumference}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${cxy} ${cxy})`}
                    style={{ strokeDashoffset: dashOffset, transition: 'stroke-dashoffset 0.6s ease' }} />
                ))}
                <text x={cxy} y={cxy - 4} textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="800">{completionRate}%</text>
                <text x={cxy} y={cxy + 14} textAnchor="middle" fill="var(--text2)" fontSize="10">完成率</text>
              </svg>
              <div className="donut-legend">
                {slices.map((s, i) => (
                  <div key={i} className="donut-legend-item">
                    <span className="donut-legend-dot" style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <span className="donut-legend-count">{s.count} ({s.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
