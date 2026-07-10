import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 16,
          fontFamily: 'Satoshi, system-ui, sans-serif',
          color: 'var(--text)', padding: 24, background: 'var(--bg)'
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>出错了</h1>
          <p style={{ color: 'var(--text2)', textAlign: 'center', maxWidth: 400 }}>
            应用遇到了意外错误，请尝试刷新页面。如果问题持续，请联系开发者。
          </p>
          <pre style={{
            background: 'var(--surface2)', padding: 16, borderRadius: 12,
            maxWidth: '90vw', overflow: 'auto',
            fontSize: 13, color: 'var(--danger)'
          }}>
            {this.state.error?.message || '未知错误'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
