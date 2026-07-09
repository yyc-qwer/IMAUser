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
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const list = await getBlocks(taskId);
    if (list.length === 0) {
      const h = await addBlock(taskId, 'heading', '', 0);
      const t = await addBlock(taskId, 'text', '', 1);
      if (h && t) setBlocks([h, t]);
      else if (h) setBlocks([h]);
      else if (t) setBlocks([t]);
    } else {
      setBlocks(list);
    }
  }, [taskId, getBlocks, addBlock]);

  useEffect(() => {
    loadedRef.current = false;
    load();
  }, [load]);

  const saveOrder = async (newBlocks) => {
    const ids = newBlocks.map(b => b.id);
    await reorderBlocks(ids);
  };

  const handleAdd = async (afterIdx, type = 'text') => {
    const insertIdx = afterIdx + 1;
    const indent = blocks[afterIdx]?.indent || 0;
    const b = await addBlock(taskId, type, '', insertIdx, indent);
    if (!b) return;
    const newBlocks = [...blocks];
    newBlocks.splice(insertIdx, 0, b);
    const reordered = newBlocks.map((blk, i) => ({ ...blk, order: i }));
    setBlocks(reordered);
    await saveOrder(reordered);
    setFocusId(b.id);
  };

  const handleChange = async (id, content) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    await updateBlock(id, { content });
  };

  const handleToggle = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newMeta = { ...(b.meta || {}), checked: !(b.meta?.checked || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta: newMeta } : x));
    await updateBlock(id, { meta: newMeta });
  };

  const handleToggleCollapse = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newMeta = { ...(b.meta || {}), collapsed: !(b.meta?.collapsed || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta: newMeta } : x));
    await updateBlock(id, { meta: newMeta });
  };

  const handleDelete = async (id) => {
    if (blocks.length <= 1) return;
    await deleteBlock(id);
    const newBlocks = blocks.filter(b => b.id !== id);
    const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
    setBlocks(reordered);
    await saveOrder(reordered);
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
    const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
    setBlocks(reordered);
    setDragId(null);
    await saveOrder(reordered);
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
            <input {...commonProps} />
          </div>
        );
      case 'toggle':
        return (
          <div className="block-toggle-row">
            <button className="toggle-btn-small" onClick={() => handleToggleCollapse(b.id)}>
              {b.meta?.collapsed ? '▶' : '▼'}
            </button>
            <input {...commonProps} />
          </div>
        );
      case 'bulleted_list':
        return (
          <div className="block-list-row">
            <span className="list-bullet">•</span>
            <input {...commonProps} />
          </div>
        );
      case 'numbered_list': {
        const idx = blocks.filter(x => x.type === 'numbered_list' && x.order <= b.order).length;
        return (
          <div className="block-list-row">
            <span className="list-number">{idx}.</span>
            <input {...commonProps} />
          </div>
        );
      }
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
      const prev = blocks[idx - 1];
      handleDelete(id);
      if (prev) setFocusId(prev.id);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleIndent(id, e.shiftKey ? -1 : 1);
    }
  };

  useEffect(() => {
    if (focusId) {
      setTimeout(() => {
        const el = editorRef.current?.querySelector(`[data-block-id="${focusId}"] input`);
        el?.focus();
        setFocusId(null);
      }, 50);
    }
  }, [focusId]);

  // 点击外部关闭菜单
  useEffect(() => {
    const click = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setConvertMenu(null);
      }
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);

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
          <div className={`block-actions ${hoverId === b.id ? 'visible' : ''}`}>
            <button className="block-add" title="下方添加" onClick={(e) => { e.stopPropagation(); handleAdd(i); }}>+</button>
            <button
              className="block-handle"
              title="拖拽排序 / 转换类型"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setConvertMenu({ x: rect.left, y: rect.bottom + 4, blockId: b.id });
              }}
            >⋮⋮</button>
          </div>

          {renderBlockContent(b)}
        </div>
      ))}

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
