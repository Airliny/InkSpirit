import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

/** Catch render errors in a subtree instead of blanking the whole window */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) }
  }

  componentDidCatch(err: unknown): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          页面出错了：{this.state.message || '未知错误'}
        </div>
      )
    }
    return this.props.children
  }
}
