import { useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AnimationState, AvatarDescriptor, BodyState } from '../../core/avatar/types'
import { DEFAULT_BODY_STATE } from '../../core/avatar/types'
import { getAvatarAdapter } from './registry'
import { renderBuiltin } from './adapters/builtinAdapter'

/**
 * 会话级「avatar ready」启动日志（只记一次，描述实际渲染结果）：
 * 成功 → avatar ready type=live2d；失败回退 → [ERROR] ... fallback=builtin。
 * startup.log 由此能给出完整生命周期：app ready → database → window → renderer → avatar。
 */
let avatarReadyLogged = false
function logAvatarReady(body: AvatarDescriptor, broken: boolean): void {
  if (avatarReadyLogged) return
  avatarReadyLogged = true
  const line = broken
    ? `[ERROR] avatar initialization failed fallback=builtin (${body.id})`
    : `avatar ready type=${body.type}`
  window.inkAPI.logEvent('startup', line).catch(() => {})
}

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

  // 会话首次挂载：记录实际渲染结果（成功 → avatar ready；失败 → [ERROR] fallback=builtin）。
  // 延迟到子适配器 effect 跑完再记录，瞬时失败不会误报「ready」。
  const brokenRef = useRef(broken)
  const bodyRef = useRef(renderedBody)
  useEffect(() => { brokenRef.current = broken }, [broken])
  useEffect(() => { bodyRef.current = renderedBody }, [renderedBody])
  useEffect(() => {
    const t = setTimeout(() => {
      logAvatarReady(bodyRef.current, brokenRef.current || !getAvatarAdapter(bodyRef.current.type))
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const adapter = getAvatarAdapter(renderedBody.type)

  // 身体加载失败 → 回退内置「砚」，并写入 avatar.log（失败原因，绝不含模型内容）
  const handleLoadError = useCallback((reason: string) => {
    setBroken(true)
    window.inkAPI.logEvent('avatar', `${renderedBody.id} load failed: ${reason}`).catch(() => {})
    window.inkAPI.logEvent('startup', `[ERROR] avatar initialization failed fallback=builtin (${renderedBody.id}: ${reason})`).catch(() => {})
  }, [renderedBody.id])

  // Avatar 安全加载契约：loadAvatar() 绝不把异常冒泡到 UI ——
  // 渲染抛错 / 加载失败 一律返回 { success:false, fallback:'builtin' }
  let content: ReactNode
  if (!adapter || broken) {
    content = renderBuiltin(renderedBody.source, size, onClick)
  } else {
    try {
      content = adapter.render({
        source: renderedBody.source,
        state,
        bodyState,
        size,
        held,
        onClick,
        onLoadError: handleLoadError
      })
    } catch (err) {
      handleLoadError(err instanceof Error ? err.message : String(err))
      content = renderBuiltin(renderedBody.source, size, onClick)
    }
  }

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
