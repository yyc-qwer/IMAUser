import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TaskDetailPage from "./TaskDetailPage";
import { supabase } from "../supabaseClient";

export default function TaskDetailWrapper({ tasks, isMobile, pushplusToken, toggleComplete, deleteTask, updateTask, getTypeName, getTypeColor }) {
  const { taskId } = useParams();
  const navigate = useNavigate();

  // 先从内存找
  let task = tasks.find(t => t.id === taskId);
  const [fetchedTask, setFetchedTask] = useState(null);
  const [loading, setLoading] = useState(!task);

  // 内存找不到则从 Supabase 查
  useEffect(() => {
    if (task) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from('tasks').select('*').eq('id', taskId).single().then(({ data }) => {
      if (!cancelled) {
        if (data) setFetchedTask(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [taskId, task]);

  const resolvedTask = task || fetchedTask;

  if (loading) {
    return (
      <>
        <header className="main-header"><h2>任务详情</h2></header>
        <div className="notion-loading">
          <div className="notion-loading-spinner" />
          <span>加载中...</span>
        </div>
      </>
    );
  }

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
      toggleComplete={toggleComplete}
      deleteTask={deleteTask}
      updateTask={updateTask}
      getTypeName={getTypeName}
      getTypeColor={getTypeColor}
    />
  );
}
