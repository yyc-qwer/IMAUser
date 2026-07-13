import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    if (mode === 'register') {
      const { error: err } = await signUp(email, password);
      if (err) setError(err.message);
      else setError('注册成功！请查看邮箱验证');
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError('邮箱或密码错误');
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">日程看板</h1>
        <p className="auth-subtitle">登录后管理你的日程任务</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn-primary auth-btn" disabled={submitting}>
            {submitting ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <span>还没有账号？<button className="link-btn" onClick={() => { setMode('register'); setError(''); }}>去注册</button></span>
          ) : (
            <span>已有账号？<button className="link-btn" onClick={() => { setMode('login'); setError(''); }}>去登录</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
