interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatBubble({ role, content, isStreaming }: ChatBubbleProps) {
  return (
    <div className={`chat-bubble ${role} ${isStreaming ? 'streaming' : ''}`}>
      {content || (isStreaming ? '' : '...')}
    </div>
  )
}
