import { useState, useEffect, useRef } from "react";

export default function PomodoroTimer() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work');
  const intervalRef = useRef(null);

  const modes = {
    work: { min: 25, label: '专注', color: '#d9544f' },
    shortBreak: { min: 5, label: '短休息', color: '#3d7a5c' },
    longBreak: { min: 15, label: '长休息', color: '#d4855e' },
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev === 0) {
            setMinutes(m => {
              if (m === 0) {
                setIsRunning(false);
                if (Notification.permission === 'granted') {
                  new Notification('番茄钟', { body: `${modes[mode].label}时间结束！` });
                }
                return modes[mode].min;
              }
              return m - 1;
            });
            return 59;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, mode]);

  const switchMode = (m) => {
    setIsRunning(false);
    setMode(m);
    setMinutes(modes[m].min);
    setSeconds(0);
  };

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(modes[mode].min);
    setSeconds(0);
  };

  const progress = ((modes[mode].min * 60 - (minutes * 60 + seconds)) / (modes[mode].min * 60)) * 100;

  return (
    <div className="pomodoro-card">
      <div className="pomodoro-modes">
        {Object.entries(modes).map(([k, v]) => (
          <button key={k} className={`pomodoro-mode-btn ${mode === k ? 'active' : ''}`}
            style={mode === k ? { color: v.color, borderColor: v.color } : {}}
            onClick={() => switchMode(k)}>{v.label}</button>
        ))}
      </div>
      <div className="pomodoro-time" style={{ color: modes[mode].color }}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="pomodoro-progress">
        <div className="pomodoro-progress-bar" style={{ width: `${progress}%`, background: modes[mode].color }} />
      </div>
      <div className="pomodoro-actions">
        <button className="btn-primary" onClick={toggleTimer}>
          {isRunning ? '暂停' : '开始'}
        </button>
        <button className="btn-secondary" onClick={resetTimer}>重置</button>
      </div>
    </div>
  );
}
