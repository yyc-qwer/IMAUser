import PomodoroTimer from "./PomodoroTimer";

export default function PomodoroPage() {
  return (
    <>
      <header className="main-header"><h2>番茄钟</h2></header>
      <div className="pomodoro-container">
        <PomodoroTimer />
        <div className="pomodoro-info">
          <h4>什么是番茄钟？</h4>
          <p>番茄工作法是一种时间管理方法：</p>
          <ul>
            <li><strong>专注 25 分钟</strong>：全神贯注工作</li>
            <li><strong>短休息 5 分钟</strong>：放松大脑</li>
            <li><strong>长休息 15 分钟</strong>：每 4 个番茄后</li>
          </ul>
        </div>
      </div>
    </>
  );
}
