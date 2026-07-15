export default function ImportPage({ tasks, taskTypes, addTask, getTypeName, handleImport, handleStoragePull }) {
  return (
    <>
      <header className="main-header"><h2>数据处理</h2></header>
      <div className="import-area">
        <div className="import-card">
          <h3>从剪贴板导入</h3>
          <p>在浏览器插件中点击"复制数据"，然后回到此页面点击下方按钮导入。</p>
          <button className="btn-primary" onClick={handleImport}>从剪贴板导入</button>
        </div>
        <div className="import-card">
          <h3>从浏览器存储导入</h3>
          <p>在 IMAU 导入插件中点击"写入日程看板"，然后在此页面点击下方按钮拉取。</p>
          <button className="btn-accent" onClick={handleStoragePull}>从存储拉取</button>
        </div>
        <div className="import-card">
          <h3>导出 CSV</h3>
          <p>将所有任务导出为 CSV 表格文件，方便在 Excel 或 WPS 中查看和分析。</p>
          <button className="btn-primary" onClick={() => {
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
          }}>导出 CSV</button>
        </div>
      </div>
    </>
  );
}
