import { useState, useEffect, useCallback, useRef } from 'react';
import { useBlocks } from '../hooks/useBlocks';

export default function NotionBlockEditor({ taskId }) {
  const { getBlocks, addBlock, updateBlock, deleteBlock, reorderBlocks } = useBlocks();
  const [blocks, setBlocks] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [convertMenu, setConvertMenu] = useState(null);
  const editorRef = useRef(null);

  const load = useCallback(async () => {
    const list = await getBlocks(taskId);
    if (list.length === 0) {
      const h = await addBlock(taskId, 'heading', '', 0);
      const t = await addBlock(taskId, 'text', '', 1);
      setBlocks([h, t].filter(Boolean));
    } else {
      setBlocks(list);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    const list = await getBlocks(taskId);
    setBlocks(list);
  };

  const handleAdd = async (afterIdx, type = 'text') => {
    const order = afterIdx + 1;
    const indent = blocks[afterIdx]?.indent || 0;
    const b = await addBlock(taskId, type, '', order, indent);
    if (!b) return;
    const newBlocks = [...blocks];
    newBlocks.splice(order, 0, b);
    setBlocks(newBlocks.map((blk, i) => ({ ...blk, order: i })));
    await reorderBlocks(taskId, newBlocks.map(b => b.id));
    setFocusId(b.id);
  };

  const handleChange = async (id, content) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    await updateBlock(id, { content });
  };

  const handleToggle = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const meta = { ...(b.meta || {}), checked: !(b.meta?.checked || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta } : x));
    await updateBlock(id, { meta });
  };

  const handleToggleCollapse = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const meta = { ...(b.meta || {}), collapsed: !(b.meta?.collapsed || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta } : x));
    await updateBlock(id, { meta });
  };

  const handleDelete = async (id) => {
    if (blocks.length <= 1) return;
    await deleteBlock(id);
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks.map((b, i) => ({ ...b, order: i })));
    await reorderBlocks(taskId, newBlocks.map(b => b.id));
  };

  const handleTypeChange = async (id, newType) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: newType } : b));
    await updateBlock(id, { type: newType });
    setConvertMenu(null);
  };

  const handleIndent = async (id, delta) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newIndent = Math.max(0, (b.indent || 0) + delta);
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, indent: newIndent } : x));
    await updateBlock(id, { indent: newIndent });
  };

  // 拖拽排序
  const handleDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); };
  const handleDrop = async (e, targetId) => {
    e.preventDefault(); setDragOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const from = blocks.findIndex(b => b.id === dragId);
    const to = blocks.findIndex(b => b.id === targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(from, 1);
    newBlocks.splice(to, 0, removed);
    setBlocks(newBlocks.map((b, i) => ({ ...b, order: i })));
    setDragId(null);
    await reorderBlocks(taskId, newBlocks.map(b => b.id));
  };

  const renderBlockContent = (b) => {
    const commonProps = {
      value: b.content,
      onChange: e => handleChange(b.id, e.target.value),
      onKeyDown: e => handleKeyDown(e, b.id),
      className: `block-content ${b.type}`,
      placeholder: getPlaceholder(b.type),
    };

    switch (b.type) {
      case 'heading':
        return <input {...commonProps} style={{ fontSize: '20px', fontWeight: 700 }} />;
      case 'todo':
        return (
          <div className="block-todo-row">
            <input type="checkbox" checked={!!b.meta?.checked} onChange={() => handleToggle(b.id)} />
            <input {...commonProps} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)' }} />
          </div>
        );
      case 'toggle':
        return (
          <div className="block-toggle-row">
            <button className="toggle-btn-small" onClick={() => handleToggleCollapse(b.id)}>
              {b.meta?.collapsed ? '▶' : '▼'}
            </button>
            <input {...commonProps} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)' }} />
          </div>
        );
      case 'bulleted_list':
        return (
          <div className="block-list-row">
            <span className="list-bullet">•</span>
            <input {...commonProps} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)' }} />
          </div>
        );
      case 'numbered_list':
        const idx = blocks.filter(x => x.type === 'numbered_list' && x.order <= b.order).length;
        return (
          <div className="block-list-row">
            <span className="list-number">{idx}.</span>
            <input {...commonProps} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)' }} />
          </div>
        );
      default:
        return <input {...commonProps} />;
    }
  };

  const handleKeyDown = (e, id) => {
    const idx = blocks.findIndex(b => b.id === id);
    const b = blocks[idx];

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd(idx);
    }

    if (e.key === 'Backspace' && b?.content === '' && blocks.length > 1) {
      e.preventDefault();
      handleDelete(id);
      const prev = blocks[idx - 1];
      if (prev) setFocusId(prev.id);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleIndent(id, e.shiftKey ? -1 : 1);
    }
  };

  useEffect(() => {
    if (focusId) {
      const el = editorRef.current?.querySelector(`[data-block-id="${focusId}"] input`);
      el?.focus();
      setFocusId(null);
    }
  }, [focusId]);

  const getPlaceholder = (type) => {
    const map = {
      text: "输入内容...",
      heading: "标题",
      todo: "待办事项",
      toggle: "折叠列表",
      bulleted_list: "列表项",
      numbered_list: "列表项",
    };
    return map[type] || "输入内容...";
  };

  return (
    <div className="notion-editor" ref={editorRef}>
      {blocks.map((b, i) => (
        <div
          key={b.id}
          className={`notion-block ${b.type} ${dragId === b.id ? 'dragging' : ''} ${dragOverId === b.id ? 'drag-over' : ''}`}
          style={{ paddingLeft: `${(b.indent || 0) * 24 + 40}px` }}
          draggable
          onDragStart={e => handleDragStart(e, b.id)}
          onDragOver={e => handleDragOver(e, b.id)}
          onDrop={e => handleDrop(e, b.id)}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
          onMouseEnter={() => setHoverId(b.id)}
          onMouseLeave={() => setHoverId(null)}
          data-block-id={b.id}
        >
          {/* 左侧操作区 */}
          <div className={`block-actions ${hoverId === b.id ? 'visible' : ''}`}>
            <button className="block-add" title="下方添加" onClick={() => handleAdd(i)}>+</button>
            <button
              className="block-handle"
              title="拖拽排序 / 转换类型"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setConvertMenu({ x: rect.left, y: rect.bottom + 4, blockId: b.id });
              }}
            >⋮⋮</button>
          </div>

          {/* 内容区 */}
          {renderBlockContent(b)}
        </div>
      ))}

      {/* 转换菜单 */}
      {convertMenu && (
        <div className="convert-menu" style={{ left: convertMenu.x, top: convertMenu.y }}>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'text')}>📝 文本</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'heading')}># 标题</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'todo')}>☑️ 待办</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'bulleted_list')}>• 无序列表</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'numbered_list')}>1. 有序列表</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'toggle')}>▼ 折叠列表</div>
        </div>
      )}
    </div>
  );
}
