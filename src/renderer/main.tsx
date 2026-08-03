import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initThemeSync } from './design/theme'
import './design/tokens.css'

initThemeSync()

// 根级兜底：即使 App 首次渲染就抛错，也绝不出现"空白窗口"——
// 至少能看到砚灵标识和重新加载按钮（日志里 console.error 也会被主进程记录）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 13,
          fontFamily: 'var(--font)'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--ink-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 600
          }}>砚</div>
          <div style={{ lineHeight: 1.7, textAlign: 'center' }}>
            砚灵正在醒来…
            <br />
            如果一直停在这里，请重启应用。
          </div>
          <button
            onClick={() => location.reload()}
            style={{
              padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--surface-solid)', color: 'var(--text-primary)',
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            重新加载
          </button>
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
