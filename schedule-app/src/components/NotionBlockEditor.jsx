import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useBlocks } from '../hooks/useBlocks';

export default function NotionBlockEditor({ taskId, isMobile }) {
  const { getBlocks, addBlock, updateBlock, deleteBlock, reorderBlocks } = useBlocks();
  const [blocks, setBlocks] = useState([]);
  const [hoverId, setHoverId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [convertMenu, setConvertMenu] = useState(null);
  const [activeBlockMenu, setActiveBlockMenu] = useState(null);

  // -- Desktop drag --
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragGroupRef = useRef(null); // { fromIdx, toIdx } range of children when dragging a toggle

  // -- Touch drag (mobile) --
  const [touchDrag, setTouchDrag] = useState(null);
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);
  const editorRef = useRef(null);
  const loadedRef = useRef(false);

  // -- Helper: find parent toggle of a block --
  const findParentToggle = useCallback((idx) => {
    if (idx <= 0 || idx >= blocks.length) return null;
    const currentIndent = blocks[idx]?.indent || 0;
    if (currentIndent <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
      if ((blocks[i].indent || 0) < currentIndent) {
        return blocks[i].type === 'toggle' ? { block: blocks[i], idx: i } : null;
      }
    }
    return null;
  }, [blocks]);

  // -- Helper: get child range for a toggle (all consecutive blocks with indent > toggle.indent) --
  const getChildRange = useCallback((toggleIdx) => {
    const toggle = blocks[toggleIdx];
    if (!toggle || toggle.type !== 'toggle') return null;
    const minIndent = toggle.indent || 0;
    let end = toggleIdx;
    for (let i = toggleIdx + 1; i < blocks.length; i++) {
      if ((blocks[i].indent || 0) > minIndent) end = i;
      else break;
    }
    if (end === toggleIdx) return null; // no children
    return { start: toggleIdx + 1, end };
  }, [blocks]);

  // -- Collapsed toggle: visible blocks --
  const visibleBlocks = useMemo(() => {
    const result = [];
    let skipUntilIndent = Infinity;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if ((b.indent || 0) > skipUntilIndent) continue;
      skipUntilIndent = Infinity;
      result.push({ block: b, originalIdx: i });
      if (b.type === 'toggle' && b.meta?.collapsed) {
        skipUntilIndent = b.indent || 0;
      }
    }
    return result;
  }, [blocks]);

  // -- Load --
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

  // -- Persist order --
  const saveOrder = async (newBlocks) => {
    await reorderBlocks(newBlocks.map(b => b.id));
  };

  // -- Inherit type --
  const getInheritedType = (parentBlock) => {
    if (!parentBlock) return 'text';
    if (['bulleted_list', 'todo'].includes(parentBlock.type)) return parentBlock.type;
    return 'text';
  };

  // -- Add block --
  const handleAdd = async (afterVisibleIdx, _forceType) => {
    const v = visibleBlocks[afterVisibleIdx];
    const parentBlock = v ? v.block : null;
    const afterOriginalIdx = v ? v.originalIdx : (blocks.length > 0 ? blocks.length - 1 : -1);

    // Determine type and indent for new block
    let type, indent;
    if (parentBlock?.type === 'toggle') {
      // + button after a toggle: create indent+1 text child
      type = 'text';
      indent = (parentBlock.indent || 0) + 1;
    } else if (parentBlock && (parentBlock.indent || 0) > 0) {
      // Parent is indented → check if it's inside a toggle
      const parentToggle = findParentToggle(afterOriginalIdx);
      if (parentToggle) {
        // Child of toggle: inherit current block's type if it's a list type
        type = getInheritedType(parentBlock);
        indent = parentBlock.indent || 0;
      } else {
        type = getInheritedType(parentBlock);
        indent = parentBlock.indent || 0;
      }
    } else {
      type = getInheritedType(parentBlock);
      indent = parentBlock?.indent || 0;
    }

    const insertIdx = afterOriginalIdx + 1;
    const b = await addBlock(taskId, type, '', insertIdx, indent);
    if (!b) return;

    const newBlocks = [...blocks];
    newBlocks.splice(insertIdx, 0, b);
    const reordered = newBlocks.map((blk, i) => ({ ...blk, order: i }));
    setBlocks(reordered);
    await saveOrder(reordered);
    setFocusId(b.id);
  };

  // -- Change content --
  const handleChange = async (id, content) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    await updateBlock(id, { content });
  };

  // -- Todo toggle --
  const handleToggle = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newMeta = { ...(b.meta || {}), checked: !(b.meta?.checked || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta: newMeta } : x));
    await updateBlock(id, { meta: newMeta });
  };

  // -- Toggle collapse --
  const handleToggleCollapse = async (id) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newMeta = { ...(b.meta || {}), collapsed: !(b.meta?.collapsed || false) };
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, meta: newMeta } : x));
    await updateBlock(id, { meta: newMeta });
    setActiveBlockMenu(null);
  };

  // -- Delete --
  const handleDelete = async (id) => {
    if (blocks.length <= 1) return;
    await deleteBlock(id);
    const newBlocks = blocks.filter(b => b.id !== id);
    const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
    setBlocks(reordered);
    await saveOrder(reordered);
  };

  // -- Type change --
  const handleTypeChange = async (id, newType) => {
    const idx = blocks.findIndex(b => b.id === id);
    const b = blocks[idx];
    if (!b) return;

    setBlocks(prev => prev.map(x => x.id === id ? { ...x, type: newType } : x));
    await updateBlock(id, { type: newType });

    // If converting to toggle, auto-create one indent+1 empty child
    if (newType === 'toggle') {
      const childIndent = (b.indent || 0) + 1;
      const child = await addBlock(taskId, 'text', '', idx + 1, childIndent);
      if (child) {
        setBlocks(prev => {
          const newBlocks = [...prev];
          const cIdx = newBlocks.findIndex(x => x.id === id) + 1;
          newBlocks.splice(cIdx, 0, child);
          return newBlocks.map((blk, i) => ({ ...blk, order: i }));
        });
        await saveOrder(
          [...blocks.slice(0, idx + 1), child, ...blocks.slice(idx + 1)].map((blk, i) => ({ ...blk, order: i }))
        );
      }
    }

    setConvertMenu(null);
    setActiveBlockMenu(null);
  };

  // -- Indent --
  const handleIndent = async (id, delta) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newIndent = Math.max(0, (b.indent || 0) + delta);
    setBlocks(prev => prev.map(x => x.id === id ? { ...x, indent: newIndent } : x));
    await updateBlock(id, { indent: newIndent });
  };

  // -- Desktop drag (with toggle group support) --
  const handleDragStart = (e, id) => {
    const idx = blocks.findIndex(b => b.id === id);
    const b = blocks[idx];
    if (!b) return;

    // If dragging a toggle, collapse its children for the drag duration
    if (b.type === 'toggle') {
      const range = getChildRange(idx);
      if (range) {
        dragGroupRef.current = range;
        // Collapse children
        setBlocks(prev => prev.map(x => {
          if (x.id === id) return { ...x, meta: { ...(x.meta || {}), collapsed: true } };
          return x;
        }));
      }
    }

    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    // Invisible drag ghost
    const ghost = document.createElement('div');
    ghost.style.cssText = 'opacity:0;position:absolute;top:-2000px;left:-2000px;width:1px;height:1px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId || dragId === targetId) { finishDrag(); return; }

    const from = blocks.findIndex(b => b.id === dragId);
    let to = blocks.findIndex(b => b.id === targetId);
    if (from === -1 || to === -1) { finishDrag(); return; }

    // Unc collapse toggle for the move operation
    const wasCollapsed = blocks.find(b => b.id === dragId)?.meta?.collapsed || false;
    if (wasCollapsed) {
      setBlocks(prev => prev.map(x => {
        if (x.id === dragId) return { ...x, meta: { ...(x.meta || {}), collapsed: false } };
        return x;
      }));
    }

    const newBlocks = [...blocks];

    // If dragging a toggle with children, move the entire range
    const range = dragGroupRef.current;
    if (range) {
      const groupSize = range.end - range.start + 2; // toggle + children
      const group = newBlocks.splice(from, groupSize);
      // Adjust target if it's after the removed group
      if (to > from) to -= groupSize;
      newBlocks.splice(to, 0, ...group);
    } else {
      const [removed] = newBlocks.splice(from, 1);
      if (to > from) to -= 1;
      newBlocks.splice(to, 0, removed);
    }

    const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
    setBlocks(reordered);
    await saveOrder(reordered);
    finishDrag();
  };

  const finishDrag = () => {
    // Uncollapse toggle that was collapsed for drag
    if (dragGroupRef.current && dragId) {
      setBlocks(prev => prev.map(x => {
        if (x.id === dragId) return { ...x, meta: { ...(x.meta || {}), collapsed: false } };
        return x;
      }));
    }
    setDragId(null);
    dragGroupRef.current = null;
  };

  // -- Mobile touch drag --
  const handleTouchStart = (e, visibleIdx) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const vb = visibleBlocks[visibleIdx];
      if (!vb) return;

      // If dragging a toggle, collapse children
      if (vb.block.type === 'toggle') {
        const idx = vb.originalIdx;
        const range = getChildRange(idx);
        if (range) {
          dragGroupRef.current = range;
          setBlocks(prev => prev.map(x => {
            if (x.id === vb.block.id) return { ...x, meta: { ...(x.meta || {}), collapsed: true } };
            return x;
          }));
        }
      }

      setTouchDrag({
        id: vb.block.id,
        originalIdx: vb.originalIdx,
        fromVisibleIdx: visibleIdx,
        toVisibleIdx: visibleIdx,
        y: touchStartPos.current.y,
      });
      if (navigator.vibrate) navigator.vibrate(10);
    }, 350);
  };

  const handleTouchMove = (e) => {
    if (!isMobile) return;
    if (longPressTimer.current && touchStartPos.current) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - touchStartPos.current.x) > 6 || Math.abs(t.clientY - touchStartPos.current.y) > 6) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!touchDrag) return;
    e.preventDefault();

    const touch = e.touches[0];
    setTouchDrag(prev => ({ ...prev, y: touch.clientY }));

    const wrappers = editorRef.current?.querySelectorAll('.notion-block-wrapper');
    if (!wrappers) return;
    let target = wrappers.length;
    for (let i = 0; i < wrappers.length; i++) {
      const rect = wrappers[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (touch.clientY < midY) { target = i; break; }
    }
    if (target !== touchDrag.toVisibleIdx) {
      setTouchDrag(prev => ({ ...prev, toVisibleIdx: target }));
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;

    if (!touchDrag) return;
    const { id, fromVisibleIdx, toVisibleIdx } = touchDrag;

    // Uncollapse toggle
    if (dragGroupRef.current && id) {
      setBlocks(prev => prev.map(x => {
        if (x.id === id) return { ...x, meta: { ...(x.meta || {}), collapsed: false } };
        return x;
      }));
    }

    if (fromVisibleIdx !== toVisibleIdx) {
      const fromV = visibleBlocks[fromVisibleIdx];
      if (!fromV) { setTouchDrag(null); dragGroupRef.current = null; touchStartPos.current = null; return; }

      const newBlocks = [...blocks];
      const range = dragGroupRef.current;

      if (range) {
        // Move toggle + children as a group
        const groupSize = range.end - range.start + 2;
        const group = newBlocks.splice(fromV.originalIdx, groupSize);
        let insertIdx;
        if (toVisibleIdx >= visibleBlocks.length) {
          insertIdx = newBlocks.length;
        } else {
          const targetV = visibleBlocks[toVisibleIdx];
          insertIdx = newBlocks.findIndex(b => b.id === targetV.block.id);
        }
        newBlocks.splice(insertIdx, 0, ...group);
      } else {
        const [removed] = newBlocks.splice(fromV.originalIdx, 1);
        let insertIdx;
        if (toVisibleIdx >= visibleBlocks.length) {
          insertIdx = newBlocks.length;
        } else {
          const targetV = visibleBlocks[toVisibleIdx];
          insertIdx = newBlocks.findIndex(b => b.id === targetV.block.id);
        }
        newBlocks.splice(insertIdx, 0, removed);
      }

      const reordered = newBlocks.map((b, i) => ({ ...b, order: i }));
      setBlocks(reordered);
      saveOrder(reordered);
    }

    setTouchDrag(null);
    dragGroupRef.current = null;
    touchStartPos.current = null;
  };

  // -- Keyboard --
  const handleKeyDown = async (e, id) => {
    const idx = blocks.findIndex(b => b.id === id);
    const b = blocks[idx];
    if (!b) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // toggle → create indent+1 child
      if (b.type === 'toggle') {
        const childIndent = (b.indent || 0) + 1;
        const insertIdx = idx + 1;
        const newBlock = await addBlock(taskId, 'text', '', insertIdx, childIndent);
        if (!newBlock) return;
        const newBlocks = [...blocks];
        newBlocks.splice(insertIdx, 0, newBlock);
        const reordered = newBlocks.map((blk, i) => ({ ...blk, order: i }));
        setBlocks(reordered);
        await saveOrder(reordered);
        setFocusId(newBlock.id);
        return;
      }

      // Child of a toggle → create sibling, inherit current block type
      const parentInfo = findParentToggle(idx);
      if (parentInfo) {
        const siblingType = getInheritedType(b);
        const insertIdx = idx + 1;
        const newBlock = await addBlock(taskId, siblingType, '', insertIdx, b.indent || 0);
        if (!newBlock) return;
        const newBlocks = [...blocks];
        newBlocks.splice(insertIdx, 0, newBlock);
        const reordered = newBlocks.map((blk, i) => ({ ...blk, order: i }));
        setBlocks(reordered);
        await saveOrder(reordered);
        setFocusId(newBlock.id);
        return;
      }

      // List types: inherit
      const vi = visibleBlocks.findIndex(v => v.block.id === id);
      if (vi >= 0) handleAdd(vi);
    }

    if (e.key === 'Backspace' && b.content === '' && blocks.length > 1) {
      e.preventDefault();
      const prev = idx > 0 ? blocks[idx - 1] : null;
      handleDelete(id);
      if (prev) setFocusId(prev.id);
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      handleIndent(id, e.shiftKey ? -1 : 1);
    }
  };

  // -- Focus new block --
  useEffect(() => {
    if (focusId) {
      const timer = setTimeout(() => {
        const el = editorRef.current?.querySelector(`[data-block-id="${focusId}"] input`);
        el?.focus();
        setFocusId(null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusId]);

  // -- Click on editor (not on menus) closes menus --
  const handleEditorClick = (e) => {
    // Don't close menus if clicking on a menu item or menu toggle button
    const target = e.target;
    if (target.closest('.convert-menu') || target.closest('.mobile-sheet') ||
        target.closest('.block-mobile-menu') || target.closest('.mobile-sheet-overlay') ||
        target.closest('.block-actions')) return;
    setConvertMenu(null);
    setActiveBlockMenu(null);
  };

  // -- Click outside closes menus --
  useEffect(() => {
    const click = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setConvertMenu(null);
        setActiveBlockMenu(null);
      }
    };
    document.addEventListener('pointerdown', click);
    return () => document.removeEventListener('pointerdown', click);
  }, []);

  // -- Prevent scroll during touch drag --
  useEffect(() => {
    if (touchDrag) {
      const prevent = (e) => e.preventDefault();
      document.addEventListener('touchmove', prevent, { passive: false });
      return () => document.removeEventListener('touchmove', prevent);
    }
  }, [touchDrag]);

  // -- Render block content --
  const renderBlockContent = (b) => {
    const commonProps = {
      value: b.content,
      onChange: e => handleChange(b.id, e.target.value),
      onKeyDown: e => handleKeyDown(e, b.id),
      className: `block-content ${b.meta?.checked ? 'done' : ''}`,
      placeholder: getPlaceholder(b.type),
    };

    switch (b.type) {
      case 'heading':
        return <input {...commonProps} style={{ fontSize: '20px', fontWeight: 700 }} />;
      case 'todo':
        return (
          <div className="block-todo-row">
            <input type="checkbox" checked={!!b.meta?.checked}
              onMouseDown={e => e.preventDefault()}
              onChange={e => { e.stopPropagation(); handleToggle(b.id); }}
              onClick={e => e.stopPropagation()}
            />
            <input {...commonProps} className={`${commonProps.className} ${b.meta?.checked ? 'todo-done' : ''}`} />
          </div>
        );
      case 'toggle':
        return (
          <div className="block-toggle-row">
            <button className="toggle-btn-small"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); e.preventDefault(); handleToggleCollapse(b.id); }}>
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
      default:
        return <input {...commonProps} />;
    }
  };

  const getPlaceholder = (type) => {
    const map = { text: '输入内容...', heading: '标题', todo: '待办事项', toggle: '折叠列表', bulleted_list: '列表项' };
    return map[type] || '输入内容...';
  };

  // -- Dragged block preview for mobile --
  const draggedBlock = touchDrag ? blocks.find(b => b.id === touchDrag.id) : null;

  return (
    <div
      className={`notion-editor${isMobile ? ' mobile' : ''}${touchDrag ? ' touch-dragging' : ''}`}
      ref={editorRef}
      onClick={handleEditorClick}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {visibleBlocks.map((vb, vi) => {
        const b = vb.block;
        const isBeingDragged = touchDrag && touchDrag.id === b.id;
        const showMarkerAbove = touchDrag && touchDrag.toVisibleIdx === vi && touchDrag.fromVisibleIdx !== vi;
        const isLast = vi === visibleBlocks.length - 1;
        const showMarkerBelow = touchDrag && touchDrag.toVisibleIdx === visibleBlocks.length &&
          isLast && touchDrag.fromVisibleIdx !== visibleBlocks.length;

        return (
          <div key={b.id} className="notion-block-wrapper" style={{ position: 'relative' }}>
            {showMarkerAbove && <div className="touch-drop-indicator" />}

            <div
              className={`notion-block ${b.type}${isMobile ? ' mobile' : ''}${dragId === b.id ? ' dragging' : ''}${dragOverId === b.id ? ' drag-over' : ''}${isBeingDragged ? ' touch-dragging-block' : ''}`}
              style={{ paddingLeft: `${(b.indent || 0) * 24 + (isMobile ? 16 : 54)}px` }}
              draggable={!isMobile}
              onDragStart={!isMobile ? e => handleDragStart(e, b.id) : undefined}
              onDragOver={!isMobile ? e => handleDragOver(e, b.id) : undefined}
              onDrop={!isMobile ? e => handleDrop(e, b.id) : undefined}
              onDragEnd={!isMobile ? finishDrag : undefined}
              onMouseEnter={!isMobile ? () => setHoverId(b.id) : undefined}
              onMouseLeave={!isMobile ? () => setHoverId(null) : undefined}
              onTouchStart={isMobile ? (e) => handleTouchStart(e, vi) : undefined}
              data-block-id={b.id}
            >
              {/* Desktop: left-side buttons */}
              {!isMobile && (
                <div className={`block-actions${hoverId === b.id ? ' visible' : ''}`}>
                  <button className="block-add" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handleAdd(vi); }}>+</button>
                  <button className="block-handle" onMouseDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setConvertMenu({ x: Math.min(rect.left, window.innerWidth - 200), y: rect.bottom + 4, blockId: b.id });
                  }}>⋮⋮</button>
                </div>
              )}

              {renderBlockContent(b)}

              {/* Mobile: right menu button */}
              {isMobile && (
                <button className="block-mobile-menu-btn" onClick={e => {
                  e.stopPropagation();
                  setActiveBlockMenu(activeBlockMenu === b.id ? null : b.id);
                  setConvertMenu(null);
                }}>⋮</button>
              )}
            </div>

            {showMarkerBelow && <div className="touch-drop-indicator" />}

            {/* Mobile: per-block dropdown menu */}
            {isMobile && activeBlockMenu === b.id && (
              <div className="block-mobile-menu">
                <button onClick={() => { handleAdd(vi); setActiveBlockMenu(null); }}>+ 在下方添加</button>
                <button onClick={e => { e.stopPropagation(); setConvertMenu({ blockId: b.id, mobile: true }); }}>
                  ⇄ 转换类型
                </button>
                <button onClick={() => handleToggleCollapse(b.id)} disabled={b.type !== 'toggle'}>
                  {b.meta?.collapsed ? '▶ 展开' : '▼ 折叠'}
                </button>
                <button onClick={() => { handleIndent(b.id, 1); setActiveBlockMenu(null); }}>→ 增加缩进</button>
                <button onClick={() => { handleIndent(b.id, -1); setActiveBlockMenu(null); }}
                  disabled={(b.indent || 0) === 0}>← 减少缩进</button>
                <button onClick={() => { handleDelete(b.id); setActiveBlockMenu(null); }}
                  style={{ color: 'var(--danger)' }} disabled={blocks.length <= 1}>✕ 删除</button>
              </div>
            )}
          </div>
        );
      })}

      {/* Mobile: bottom add button */}
      {isMobile && blocks.length > 0 && (
        <div className="block-add-bottom-bar">
          <button onClick={() => handleAdd(visibleBlocks.length - 1)}>+ 添加块</button>
        </div>
      )}

      {/* Desktop: convert menu */}
      {convertMenu && !convertMenu.mobile && (
        <div className="convert-menu" style={{ left: convertMenu.x, top: convertMenu.y }}>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'text')}>📝 文本</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'heading')}># 标题</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'todo')}>☑️ 待办</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'bulleted_list')}>• 无序列表</div>
          <div className="convert-item" onClick={() => handleTypeChange(convertMenu.blockId, 'toggle')}>▼ 折叠列表</div>
        </div>
      )}

      {/* Mobile: convert bottom sheet */}
      {convertMenu && convertMenu.mobile && (
        <>
          <div className="mobile-sheet-overlay" onClick={() => { setConvertMenu(null); setActiveBlockMenu(null); }} />
          <div className="mobile-sheet">
            <div className="mobile-sheet-title">转换为...</div>
            <button onClick={() => handleTypeChange(convertMenu.blockId, 'text')}>📝 文本</button>
            <button onClick={() => handleTypeChange(convertMenu.blockId, 'heading')}># 标题</button>
            <button onClick={() => handleTypeChange(convertMenu.blockId, 'todo')}>☑️ 待办</button>
            <button onClick={() => handleTypeChange(convertMenu.blockId, 'bulleted_list')}>• 无序列表</button>
            <button onClick={() => handleTypeChange(convertMenu.blockId, 'toggle')}>▼ 折叠列表</button>
            <button className="mobile-sheet-cancel" onClick={() => { setConvertMenu(null); setActiveBlockMenu(null); }}>取消</button>
          </div>
        </>
      )}

      {/* Touch drag: floating preview */}
      {touchDrag && draggedBlock && (
        <div
          className="touch-drag-preview"
          style={{ top: touchDrag.y - 20 }}
        >
          <div className="touch-drag-preview-inner">
            {renderBlockContent(draggedBlock)}
          </div>
        </div>
      )}
    </div>
  );
}
