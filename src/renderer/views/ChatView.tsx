import { useEffect, useRef } from 'react'
import { Avatar } from '../components/avatar/Avatar'
import { Live2DView } from '../components/avatar/Live2DView'
import { ChatBubble } from '../components/chat/ChatBubble'
import { ChatInput } from '../components/chat/ChatInput'
import type { ModelSource, AnimationState } from '../components/avatar/modelTypes'

interface ChatViewProps {
  modelSource: ModelSource
  state: AnimationState
  messages: { role: 'user' | 'assistant'; content: string }[]
  isStreaming: boolean
  modelInfo: { provider: string; model: string; localModel: string | null }
  lastRoute: 'local' | 'cloud' | null
  onSend: (message: string) => void
  onHeaderClick: () => void
}

export function ChatView({ modelSource, state, messages, isStreaming, modelInfo, lastRoute, onSend, onHeaderClick }: ChatViewProps) {
  const bubblesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bubblesRef.current
    if (!el) return
    // Auto-scroll only when the user is already near the bottom, so reading
    // older messages isn't interrupted by streaming output
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) el.scrollTop = el.scrollHeight
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
      <ChatInput onSend={onSend} disabled={isStreaming} />
      <div className="chat-model-label">{modelLabel}</div>
    </div>
  )
}
