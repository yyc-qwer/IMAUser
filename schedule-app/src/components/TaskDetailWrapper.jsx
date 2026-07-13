import { useParams, useNavigate } from "react-router-dom";
import TaskDetailPage from "./TaskDetailPage";

export default function TaskDetailWrapper({ tasks, isMobile }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return (
      <>
        <header className="main-header"><h2>任务详情</h2></header>
        <div className="empty">任务不存在或已被删除</div>
      </>
    );
  }

  return (
    <TaskDetailPage
      task={task}
      isMobile={isMobile}
      onBack={() => navigate("/")}
    />
  );
}
