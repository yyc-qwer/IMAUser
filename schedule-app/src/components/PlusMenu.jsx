import { useState, useRef, useEffect } from "react";

// "+" 按钮悬浮折叠栏：新建任务 / 任务类型
export default function PlusMenu({ onNewTask, taskTypes, newTypeName, setNewTypeName, newTypeColor, setNewTypeColor, onAddType, onDeleteType, COLORS }) {
  const [open, setOpen] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const menuRef = useRef(null);
  const leaveTimer = useRef(null);

  // 鼠标离开延迟关闭（点击菜单内部按钮时不关闭）
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // 如果点击的是菜单内部元素（包括添加按钮），不关闭
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
      setShowTypeManager(false);
    };
    // 用 mousedown 而不是 click 避免和按钮冲突
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMouseEnter = () => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setOpen(false);
      setShowTypeManager(false);
    }, 200);
  };

  return (
    <div
      className="plus-menu-wrapper"
      ref={menuRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className={`plus-btn ${open ? 'active' : ''}`} title="新建">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div className={`plus-dropdown ${open ? 'open' : ''}`}>
        <button className="plus-dropdown-item" onClick={() => { setOpen(false); onNewTask(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新建任务
        </button>
        <button className="plus-dropdown-item" onClick={() => setShowTypeManager(s => !s)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          任务类型
        </button>

        {/* 任务类型管理内嵌面板 */}
        {showTypeManager && (
          <div className="type-manager-inline">
            <div className="type-manager-input-row">
              <input
                placeholder="类型名称"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onAddType()}
              />
              <div className="type-manager-colors">
                {COLORS.map(c => (
                  <span
                    key={c}
                    className={`color-swatch-sm ${c === newTypeColor ? "selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setNewTypeColor(c)}
                  />
                ))}
              </div>
              <button className="btn-primary btn-sm" onClick={onAddType}>添加</button>
            </div>
            <div className="type-manager-list">
              {taskTypes.map(t => (
                <div key={t.id} className="type-manager-item">
                  <span className="type-dot" style={{ background: t.color }} />
                  <span className="type-name">{t.name}</span>
                  <button className="btn-icon-sm" onClick={() => onDeleteType(t.id)} title="删除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
              {taskTypes.length === 0 && <div className="type-manager-empty">暂无类型</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
