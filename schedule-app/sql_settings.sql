-- 用户设置表 (PushPlus Token 等)
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pushplus_token TEXT DEFAULT '',
  remind_before INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update" ON user_settings;

CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- 提醒记录表（服务端 cron 任务用它去重，防止重复推送）
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reminded_log (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每天每任务最多一条记录（唯一约束保证去重）
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminded_log_unique
  ON reminded_log (task_id, (reminded_at::date));

-- cron 函数用 service_role 操作，不需要 RLS 策略
-- 但如果需要前端读取，可以加：
ALTER TABLE reminded_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminded_log_select" ON reminded_log;
CREATE POLICY "reminded_log_select" ON reminded_log
  FOR SELECT USING (auth.uid() = user_id);
