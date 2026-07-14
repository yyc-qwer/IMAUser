import { useParams, useNavigate, useState, useEffect } from "react-router-dom";
import TaskDetailPage from "./TaskDetailPage";
import { supabase } from "../supabaseClient";

export default function TaskDetailWrapper({ tasks, isMobile, pushplusToken }) {
  const { taskId } = useParams();
  const navigate = useNavigate();

  // 先从内存找
  let task = tasks.find(t => t.id === taskId);
  const [fetchedTask, setFetchedTask] = useState(null);

  // 内存找不到则从 Supabase 查
  useEffect(() => {
    if (task) return;
    let cancelled = false;
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (!cancelled && data) setFetchedTask(data);
    });
    return () => { cancelled = true; };
  }, [taskId, task]);

  const resolvedTask = task || fetchedTask;

  if (!resolvedTask) {
    return (
      <>
        <header className="main-header"><h2>任务详情</h2></header>
        <div className="empty">任务不存在或已被删除</div>
      </>
    );
  }

  return (
    <TaskDetailPage
      task={resolvedTask}
      isMobile={isMobile}
      pushplusToken={pushplusToken}
      onBack={() => navigate("/")}
    />
  );
}
