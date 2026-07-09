-- Notion 风格 Block 编辑器数据表
CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'heading', 'todo', 'toggle', 'bulleted_list', 'numbered_list')),
  content TEXT NOT NULL DEFAULT '',
  indent INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocks_task ON blocks(task_id, "order");

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- 移除旧的全开放策略（如果存在）
DROP POLICY IF EXISTS "Allow all" ON blocks;

-- 仅允许访问属于自己任务的 block
CREATE POLICY "Users own blocks" ON blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = blocks.task_id
        AND tasks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = blocks.task_id
        AND tasks.user_id = auth.uid()
    )
  );
