import { useEffect, useRef, useState } from 'react';

export default function SplashScreen({ onEnter }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState(0); // 0:粒子汇聚 1:标题显现 2:副标题打字 3:按钮出现
  const [typedText, setTypedText] = useState('');
  const subtitle = '内蒙古农业大学 · 智能日程管理';

  // Canvas 粒子动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 粒子
    const particles = [];
    const count = Math.min(120, Math.floor((w * h) / 12000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    let animId;
    const draw = () => {
      ctx.fillStyle = 'rgba(15, 17, 23, 0.15)';
      ctx.fillRect(0, 0, w, h);

      // 更新和绘制粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${p.alpha})`;
        ctx.fill();

        // 连线
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 动画时序控制
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // 打字机效果
  useEffect(() => {
    if (phase < 2) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(subtitle.slice(0, i));
      if (i >= subtitle.length) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="splash-screen">
      <canvas ref={canvasRef} className="splash-canvas" />

      <div className="splash-content">
        {/* Logo 图标 */}
        <div className={`splash-logo ${phase >= 0 ? 'visible' : ''}`}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01" strokeWidth="2" />
            <path d="M12 14h.01" strokeWidth="2" />
            <path d="M16 14h.01" strokeWidth="2" />
            <path d="M8 18h.01" strokeWidth="2" />
            <path d="M12 18h.01" strokeWidth="2" />
          </svg>
        </div>

        {/* 主标题 */}
        <h1 className={`splash-title ${phase >= 1 ? 'visible' : ''}`}>
          IMAUser
        </h1>

        {/* 副标题打字机 */}
        <p className={`splash-subtitle ${phase >= 2 ? 'visible' : ''}`}>
          {typedText}
          <span className="splash-cursor">|</span>
        </p>

        {/* 进入按钮 */}
        <button
          className={`splash-enter-btn ${phase >= 3 ? 'visible' : ''}`}
          onClick={onEnter}
        >
          进入系统
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      {/* 底部装饰线 */}
      <div className={`splash-footer ${phase >= 3 ? 'visible' : ''}`}>
        <span>AI Agent 创新大赛参赛作品</span>
      </div>
    </div>
  );
}
