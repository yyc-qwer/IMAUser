// 工具箱 — AI 全链路学习工具箱
export default function ToolboxPage() {
  const tools = [
    {
      label: '魔法聊天',
      url: 'http://localhost:8501/',
      desc: 'AI 智能对话助手，随时提问、讨论、答疑',
      category: 'AI 对话',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <line x1="9" y1="10" x2="15" y2="10"/>
          <line x1="12" y1="7" x2="12" y2="13"/>
        </svg>
      ),
    },
    {
      label: '内农大论坛',
      url: 'http://localhost:5000/login',
      desc: '内蒙古农业大学校内论坛，交流学习与生活',
      category: '校园社区',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: '学习卡片',
      url: 'http://127.0.0.1:8000/',
      desc: '间隔重复记忆卡片，高效复习巩固知识',
      category: '学习工具',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="8" y1="7" x2="16" y2="7"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
          <line x1="8" y1="15" x2="12" y2="15"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <header className="main-header">
        <h2>工具箱</h2>
      </header>

      <div className="toolbox-hero">
        <p className="toolbox-hero-text">
          AI 全链路学习工具箱 — 集成学习各环节所需的工具，从对话答疑到知识复习，一站完成。
        </p>
      </div>

      <div className="toolbox-grid">
        {tools.map((tool, i) => (
          <a
            key={i}
            className="toolbox-card"
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="toolbox-icon">{tool.icon}</span>
            <div className="toolbox-info">
              <span className="toolbox-category">{tool.category}</span>
              <h4>{tool.label}</h4>
              <p>{tool.desc}</p>
            </div>
            <span className="toolbox-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/>
                <polyline points="7 7 17 7 17 17"/>
              </svg>
            </span>
          </a>
        ))}
      </div>

      <div className="toolbox-hint">
        点击卡片在新窗口打开对应工具 — 这些是独立运行的第三方服务，整合到统一入口方便切换。
      </div>
    </>
  );
}