import type { AvatarSource } from '../../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../../core/avatar/types'

/**
 * 内置身体 —— 任何时候都不会消失的「砚」。
 * 所有身体失败时的最终退路（绝不隐形）。
 */
export function BuiltinFace({ size, onClick }: { size: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative'
      }}
    >
      <div
        style={{
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px var(--accent-strong)'
        }}
      >
        <span style={{ fontSize: size * 0.22, color: '#fff', fontWeight: 700, opacity: 0.95 }}>
          砚
        </span>
      </div>
    </div>
  )
}

export function renderBuiltin(source: AvatarSource, size: number, onClick?: () => void) {
  void source
  return <BuiltinFace size={size} onClick={onClick} />
}

/** 适配器内部使用的兜底身体状态（不应出现，但类型安全第一） */
export const FALLBACK_BODY_STATE = DEFAULT_BODY_STATE
