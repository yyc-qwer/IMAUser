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
CREATE POLICY "Allow all" ON blocks FOR ALL USING (true) WITH CHECK (true);
