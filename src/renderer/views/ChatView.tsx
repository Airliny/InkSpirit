import { useEffect, useRef } from 'react'
import { Avatar } from '../components/avatar/Avatar'
import { Live2DView } from '../components/avatar/Live2DView'
import { ChatBubble } from '../components/chat/ChatBubble'
import { ChatInput, type ChatInputHandle } from '../components/chat/ChatInput'
import type { ModelSource, AnimationState } from '../components/avatar/modelTypes'
import { captureScroll, restoreScroll, saveChatScroll, getSavedChatScroll, isNearBottom } from '../chatScroll'

interface ChatViewProps {
  modelSource: ModelSource
  state: AnimationState
  messages: { role: 'user' | 'assistant'; content: string }[]
  isStreaming: boolean
  modelInfo: { provider: string; model: string; localModel: string | null }
  lastRoute: 'local' | 'cloud' | null
  onSend: (message: string) => void
  onHeaderClick: () => void
  /** true while the chat panel is the visible panel */
  active: boolean
  /** M3: conversation body state (listening/thinking/speaking/…) */
  activity?: string
}

export function ChatView({ modelSource, state, messages, isStreaming, modelInfo, lastRoute, onSend, onHeaderClick, active, activity }: ChatViewProps) {
  const bubblesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<ChatInputHandle>(null)
  const didInit = useRef(false)

  // Track the scroll position continuously so switching away always saves
  // the user's exact place (following latest vs reading history)
  useEffect(() => {
    const el = bubblesRef.current
    if (!el) return
    const onScroll = () => saveChatScroll(captureScroll(el))
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Resume on first activation of this mount:
  //   was following latest → jump to bottom (like WeChat/Discord)
  //   was reading history   → keep the exact position
  useEffect(() => {
    if (!active) return
    const el = bubblesRef.current
    if (!el) return

    if (!didInit.current) {
      didInit.current = true
      if (messages.length === 0) return
      const saved = getSavedChatScroll()
      if (saved) {
        // following latest → bottom; reading history → exact position
        restoreScroll(el, saved)
      } else {
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight
        })
      }
    }
    // Returning to the conversation: keyboard focus back to the input
    inputRef.current?.focus()
  }, [active])

  useEffect(() => {
    const el = bubblesRef.current
    if (!el) return
    const last = messages[messages.length - 1]
    // First mount (e.g. app start with a history): land at the bottom
    if (!didInit.current) {
      didInit.current = true
      if (messages.length === 0) return
      el.scrollTop = el.scrollHeight
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
      return
    }
    // The user just sent a message: jump to the bottom so it's visible
    if (last?.role === 'user') {
      el.scrollTop = el.scrollHeight
      return
    }
    // Otherwise auto-scroll only when already near the bottom, so reading
    // older messages isn't interrupted by streaming output
    if (isNearBottom(el)) el.scrollTop = el.scrollHeight
  }, [messages])

  const modelLabel = lastRoute === 'local' && modelInfo.localModel
    ? `本地 · ${modelInfo.localModel}`
    : `${modelInfo.provider} · ${modelInfo.model || '未配置'}`

  return (
    <div className="chat-panel">
      <div className="chat-pet-avatar" onClick={onHeaderClick}>
        {modelSource.type === 'live2d' ? (
          <Live2DView modelPath={modelSource.live2d.modelPath} state={state} width={72} height={72} />
        ) : (
          <Avatar sprites={modelSource.type === 'sprites' ? modelSource.sprites : {}} state={state} size={72} />
        )}
      </div>
      <div className="chat-bubbles" ref={bubblesRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-bubble">你好，我是你的桌面伙伴。</div>
            <div className="chat-empty-bubble delay">可以随时点击我聊天。</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'} />
        ))}
      </div>
      <ChatInput ref={inputRef} onSend={onSend} disabled={isStreaming} />
      <div className="chat-model-label">{modelLabel}</div>
    </div>
  )
}
