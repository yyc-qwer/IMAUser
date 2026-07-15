// 工具箱 — 快捷网址入口
export default function ToolboxPage() {
  const links = [
    { label: '工具 1', url: '', desc: '网址待填写' },
    { label: '工具 2', url: '', desc: '网址待填写' },
    { label: '工具 3', url: '', desc: '网址待填写' },
    { label: '工具 4', url: '', desc: '网址待填写' },
  ];

  return (
    <>
      <header className="main-header"><h2>工具箱</h2></header>
      <div className="toolbox-grid">
        {links.map((link, i) => (
          <a
            key={i}
            className={`toolbox-card ${link.url ? '' : 'disabled'}`}
            href={link.url || '#'}
            target={link.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={e => { if (!link.url) e.preventDefault(); }}
          >
            <span className="toolbox-icon">{link.label.slice(0, 2)}</span>
            <div className="toolbox-info">
              <h4>{link.label}</h4>
              <p>{link.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
