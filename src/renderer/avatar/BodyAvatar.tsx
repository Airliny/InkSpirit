import { useEffect, useRef, useState, useCallback } from 'react'
import type { AnimationState, AvatarDescriptor, BodyState } from '../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../core/avatar/types'
import { getAvatarAdapter } from './registry'
import { renderBuiltin } from './adapters/builtinAdapter'

/**
 * 统一身体渲染入口 —— UI 只知道「这是一个身体」。
 * 不知道 Live2D / Sprite / VRM 的区别；身体加载失败时落到内置「砚」，绝不隐形。
 */
export interface BodyAvatarProps {
  body: AvatarDescriptor
  state?: AnimationState
  bodyState?: BodyState
  size?: number
  held?: boolean
  onClick?: () => void
}

/**
 * 统一身体渲染入口 —— UI 只知道「这是一个身体」。
 * 不知道 Live2D / Sprite / VRM 的区别；身体加载失败时落到内置「砚」，绝不隐形。
 * 换身体有仪式感：淡出 → 切换 → 淡入（换衣服，不是新角色登场）。
 */
export function BodyAvatar({ body, state = 'idle', bodyState = DEFAULT_BODY_STATE, size = 200, held, onClick }: BodyAvatarProps) {
  const [broken, setBroken] = useState(false)
  const [renderedBody, setRenderedBody] = useState(body)
  const [fading, setFading] = useState(false)
  const [show, setShow] = useState(true)
  const firstMount = useRef(true)

  // 换身体仪式感：旧身体淡出 → 加载新身体 → 淡入
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false
      return
    }
    if (renderedBody.id === body.id) return
    setBroken(false)
    setFading(true)
    setShow(false)
    const t = setTimeout(() => {
      setRenderedBody(body)
      setFading(false)
      setShow(true)
    }, 250)
    return () => clearTimeout(t)
  }, [body, renderedBody.id])

  // 换身体后重置失败标记，给新身体一次机会
  useEffect(() => { setBroken(false) }, [renderedBody.id])

  const adapter = getAvatarAdapter(renderedBody.type)

  // 身体加载失败 → 回退内置「砚」，并写入 avatar.log（失败原因，绝不含模型内容）
  const handleLoadError = useCallback((reason: string) => {
    setBroken(true)
    window.inkAPI.logEvent('avatar', `${renderedBody.id} load failed: ${reason}`).catch(() => {})
  }, [renderedBody.id])

  const content = (!adapter || broken)
    ? renderBuiltin(renderedBody.source, size, onClick)
    : adapter.render({
        source: renderedBody.source,
        state,
        bodyState,
        size,
        held,
        onClick,
        onLoadError: handleLoadError
      })

  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transition: fading ? 'opacity 250ms ease-in' : 'opacity 300ms ease-out',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {content}
    </div>
  )
}
