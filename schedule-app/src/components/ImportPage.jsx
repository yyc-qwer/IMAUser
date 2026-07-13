import { toast } from "./Toast";

export default function ImportPage({ tasks, taskTypes, addTask, getTypeName, handleImport, handleStoragePull }) {
  return (
    <>
      <header className="main-header"><h2>导入数据</h2></header>
      <div className="import-area">
        <div className="import-card">
          <h3>从剪贴板导入</h3>
          <p>在浏览器插件中点击"复制 JSON"，然后回到此页面点击下方按钮导入。</p>
          <button className="btn-primary" onClick={handleImport}>从剪贴板导入</button>
        </div>
        <div className="import-card">
          <h3>从浏览器存储导入</h3>
          <p>在 IMAU 导入插件中点击"写入日程看板"，然后在此页面点击下方按钮拉取。</p>
          <button className="btn-accent" onClick={handleStoragePull}>从存储拉取</button>
        </div>
        <div className="import-card">
          <h3>手动粘贴 JSON</h3>
          <p>如果你已经有导出的 JSON 数据，可以直接粘贴。</p>
          <button className="btn-secondary" onClick={handleImport}>读取剪贴板 JSON</button>
        </div>
        <div className="import-card">
          <h3>导出数据</h3>
          <p>将所有任务导出为 JSON 文件，方便备份或迁移。</p>
          <button className="btn-primary" onClick={() => {
            const data = JSON.stringify(tasks, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `schedule-export-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
          }}>导出 JSON</button>
        </div>
        <div className="import-card">
          <h3>导出 CSV</h3>
          <p>将任务导出为 CSV 表格，方便在 Excel 中查看。</p>
          <button className="btn-secondary" onClick={() => {
            const headers = ['id', 'title', 'type', 'priority', 'startDate', 'endDate', 'completed', 'notes'];
            const rows = tasks.map(t => [t.id, t.title, getTypeName(t.typeId), t.priority || 'medium', t.startDate || '', t.endDate || '', t.completed ? '是' : '否', t.notes || '']);
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
