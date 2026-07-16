import { toast } from "./Toast";

export default function AnalyticsPage({ tasks, taskTypes, activeTasks, completedTasks, getTypeName }) {
  const total = tasks.length;
  const completionRate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

  const slices = [
    { label: '已完成', count: completedTasks.length, color: '#2f81f7', pct: completionRate },
    { label: '进行中', count: activeTasks.length, color: '#58a6ff', pct: 100 - completionRate },
  ].filter(s => s.count > 0);

  const r = 36, cxy = 50, circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcPaths = slices.map((s, i) => {
    const dashLen = (s.pct / 100) * circumference;
    const dashOffset = circumference - offset;
    offset += dashLen;
    return { ...s, dashLen, dashOffset, i };
  });

  const typeStats = taskTypes.map(t => {
    const count = tasks.filter(task => task.typeId === t.id).length;
    return { ...t, count };
  }).filter(t => t.count > 0).sort((a, b) => b.count - a.count);
  const maxTypeCount = Math.max(...typeStats.map(t => t.count), 1);

  const exportCSV = () => {
    const headers = ['标题', '类型', '优先级', '开始日期', '截止日期', '状态', '备注'];
    const rows = tasks.map(t => [
      t.title, getTypeName(t.typeId),
      { high: '高', medium: '中', low: '低' }[t.priority || 'medium'],
      t.startDate || '', t.endDate || '',
      t.completed ? '已完成' : '进行中', t.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `schedule-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast('导出成功', 'success');
  };

  return (
    <>
      <header className="main-header"><h2>数据分析</h2></header>
      <div className="analytics-grid">
        <div className="chart-card summary-card">
          <h4>总览</h4>
          <div className="summary-grid">
            <div className="summary-item"><span className="sum-val">{total}</span><span className="sum-label">总任务数</span></div>
            <div className="summary-item"><span className="sum-val">{activeTasks.length}</span><span className="sum-label">进行中</span></div>
            <div className="summary-item"><span className="sum-val">{completedTasks.length}</span><span className="sum-label">已完成</span></div>
            <div className="summary-item"><span className="sum-val">{completionRate}%</span><span className="sum-label">完成率</span></div>
          </div>
        </div>

        <div className="chart-card">
          <h4>完成率</h4>
          {total === 0 ? <div className="empty">暂无数据</div> : (
            <div className="donut-wrapper">
              <svg viewBox="0 0 100 100" className="donut-svg" style={{ width: 160, height: 160 }}>
                <circle cx={cxy} cy={cxy} r={r} fill="none" stroke="var(--surface2)" strokeWidth="12" />
                {arcPaths.length === 1 ? (
                  <circle cx={cxy} cy={cxy} r={r} fill="none"
                    stroke={arcPaths[0].color} strokeWidth="12"
                    strokeDasharray={circumference}
                    transform={`rotate(-90 ${cxy} ${cxy})`} />
                ) : (
                  arcPaths.map(({ color, dashLen, dashOffset, i }) => (
                    <circle key={i} cx={cxy} cy={cxy} r={r} fill="none" stroke={color} strokeWidth="12"
                      strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                      strokeDashoffset={circumference}
                      transform={`rotate(-90 ${cxy} ${cxy})`}
                      style={{ strokeDashoffset: dashOffset, transition: 'stroke-dashoffset 0.6s ease' }} />
                  ))
                )}
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

        {typeStats.length > 0 && (
          <div className="chart-card type-distribution-card">
            <h4>任务类型分布</h4>
            <div className="type-bars">
              {typeStats.map(t => (
                <div key={t.id} className="type-bar-row">
                  <span className="type-bar-label" style={{ color: t.color }}>{t.name}</span>
                  <div className="type-bar-track">
                    <div className="type-bar-fill" style={{ width: `${(t.count / maxTypeCount) * 100}%`, background: t.color }} />
                  </div>
                  <span className="type-bar-count">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chart-card export-card">
          <h4>导出数据</h4>
          <p className="export-desc">将所有任务导出为 CSV 文件，可在 Excel 或 WPS 中查看分析。</p>
          <button className="btn-primary" onClick={exportCSV}>导出 CSV</button>
        </div>
      </div>
    </>
  );
}