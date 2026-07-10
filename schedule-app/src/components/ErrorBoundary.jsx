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
          fontFamily: 'Satoshi, system-ui, sans-serif', color: '#1c1915', padding: 24, background: '#f9f6f0'
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>出错了</h1>
          <p style={{ color: '#6e6860', textAlign: 'center', maxWidth: 400 }}>
            应用遇到了意外错误，请尝试刷新页面。如果问题持续，请联系开发者。
          </p>
          <pre style={{
            background: '#f2ede4', padding: 16, borderRadius: 12,
            maxWidth: '90vw', overflow: 'auto',
            fontSize: 13, color: '#c94a4a'
          }}>
            {this.state.error?.message || '未知错误'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: '#3d7a5c', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600
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
