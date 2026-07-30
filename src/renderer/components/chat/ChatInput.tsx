import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-input-container">
      <input
        ref={inputRef}
        className="chat-input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="想说点什么..."
        disabled={disabled}
      />
      <button
        className="chat-send-btn"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
      >
        ↑
      </button>
    </div>
  )
}
