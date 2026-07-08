export default function Skeleton() {
  return (
    <div className="skeleton-container">
      {/* 侧边栏骨架 */}
      <aside className="skeleton-sidebar">
        <div className="skeleton-logo" />
        <div className="skeleton-nav">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-nav-item" />
          ))}
        </div>
        <div className="skeleton-stats">
          <div className="skeleton-stat" />
          <div className="skeleton-stat" />
        </div>
      </aside>

      {/* 主内容骨架 */}
      <main className="skeleton-main">
        <div className="skeleton-header">
          <div className="skeleton-title" />
          <div className="skeleton-btn" />
        </div>
        <div className="skeleton-filters">
          <div className="skeleton-filter" />
          <div className="skeleton-filter" />
          <div className="skeleton-filter" />
        </div>
        <div className="skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-title" />
              <div className="skeleton-card-line" />
              <div className="skeleton-card-line short" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}