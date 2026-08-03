import { useEffect, useRef } from 'react'
import { BodyAvatar } from '../avatar/BodyAvatar'
import { ChatBubble } from '../components/chat/ChatBubble'
import { ChatInput, type ChatInputHandle } from '../components/chat/ChatInput'
import { IconGear, IconMinus } from '../components/icons'
import type { AvatarDescriptor, AnimationState } from '../../core/avatar/types'
import { captureScroll, restoreScroll, saveChatScroll, getSavedChatScroll, isNearBottom } from '../chatScroll'

interface ChatViewProps {
  body: AvatarDescriptor
  state: AnimationState
  messages: { role: 'user' | 'assistant'; content: string }[]
  isStreaming: boolean
  modelInfo: { provider: string; model: string; localModel: string | null }
  lastRoute: 'local' | 'cloud' | null
  onSend: (message: string) => void
  onBackToPet: () => void
  onOpenSettings: () => void
  /** true while the chat panel is the visible panel */
  active: boolean
  /** M3: conversation body state (listening/thinking/speaking/…) */
  activity?: string
  petName?: string
}

export function ChatView({ body, state, messages, isStreaming, modelInfo, lastRoute, onSend, onBackToPet, onOpenSettings, active, activity, petName }: ChatViewProps) {
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

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Claude', deepseek: 'DeepSeek', ollama: 'Ollama', custom: '自定义'
  }
  const modelLabel = lastRoute === 'local' && modelInfo.localModel
    ? `本地 · ${modelInfo.localModel}`
    : `${providerLabels[modelInfo.provider] ?? modelInfo.provider} · ${modelInfo.model || '未配置'}`

  const name = petName || '砚灵'

  return (
    <div className="chat-panel">
      <div className="companion-header">
        <div className="companion-avatar" onClick={onBackToPet} title="回到桌面">
          <BodyAvatar body={body} state={state} size={44} />
        </div>
        <div className="companion-id">
          <div className="companion-name">{name}</div>
          <div className="companion-status">
            <span className="companion-status-dot" />
            在线
          </div>
        </div>
        <div className="companion-actions">
          <button className="title-btn" onClick={onOpenSettings} title="设置"><IconGear size={15} /></button>
          <button className="title-btn" onClick={onBackToPet} title="回到桌面"><IconMinus size={15} /></button>
        </div>
      </div>
      <div className="chat-bubbles" ref={bubblesRef}>
        {messages.length === 0 && (
          <div className="chat-presence">
            <div className="chat-presence-avatar">
              <BodyAvatar body={body} state={state} size={76} />
            </div>
            <div className="chat-presence-text">
              <strong>{name}</strong> 在这里。
              <br />
              你好，今天是我们第一次见面。
              <br />
              有什么事情想和我聊聊吗？
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'} />
        ))}
      </div>
      <ChatInput ref={inputRef} onSend={onSend} disabled={isStreaming} placeholder={`和${name}说点什么...`} />
      <div className="chat-model-label">{modelLabel}</div>
    </div>
  )
}
