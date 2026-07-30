import { useState, useEffect } from 'react'
import { Avatar } from './components/Avatar'
import { ChatBubble } from './components/ChatBubble'
import { ChatInput } from './components/ChatInput'
import { useChatStore } from './stores/chatStore'
import { useAvatarStore } from './stores/avatarStore'
import './App.css'

declare global {
  interface Window {
    inkAPI: import('../preload/index').InkAPI
  }
}

type View = 'avatar' | 'chat' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('avatar')
  const {
    messages,
    isStreaming,
    addUserMessage,
    appendAssistantChunk,
    finishAssistantMessage,
    clearChat
  } = useChatStore()
  const { expression, setExpression } = useAvatarStore()

  useEffect(() => {
    const unsubChunk = window.inkAPI.onChatChunk((chunk) => {
      appendAssistantChunk(chunk)
    })
    const unsubDone = window.inkAPI.onChatDone(() => {
      finishAssistantMessage()
      setExpression('neutral')
    })

    return () => {
      unsubChunk()
      unsubDone()
    }
  }, [])

  async function handleSend(message: string) {
    addUserMessage(message)
    setView('chat')
    setExpression('happy')
    try {
      await window.inkAPI.chat(message)
    } catch (e) {
      appendAssistantChunk('抱歉，我暂时无法回应...请检查 API 设置。')
      finishAssistantMessage()
      setExpression('sad')
    }
  }

  function handleAvatarClick() {
    if (view === 'avatar') {
      setView('chat')
    } else if (view === 'chat') {
      setView('avatar')
    }
  }

  return (
    <div className="app-container">
      {/* Title bar */}
      <div className="title-bar">
        <span className="title-text">砚灵 InkSpirit</span>
        <div className="title-actions">
          <button
            className="title-btn"
            onClick={() => setView(view === 'settings' ? 'avatar' : 'settings')}
            title="设置"
          >
            ⚙
          </button>
          <button
            className="title-btn"
            onClick={() => window.inkAPI.minimizeWindow()}
            title="最小化"
          >
            ─
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {view === 'avatar' && (
          <div className="avatar-view" onClick={handleAvatarClick}>
            <Avatar expression={expression} />
            <p className="avatar-hint">点击与我对话</p>
          </div>
        )}

        {view === 'chat' && (
          <div className="chat-view">
            <div className="chat-header" onClick={handleAvatarClick}>
              <div className="chat-avatar-mini">
                <Avatar expression={expression} size="small" />
              </div>
              <span className="chat-header-name">砚灵</span>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-welcome">
                  <p>你好，我是砚灵。你的 AI 桌面伙伴。</p>
                  <p>今天过得怎么样？</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
            </div>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        )}

        {view === 'settings' && (
          <div className="settings-view">
            <h3>设置</h3>
            <SettingsPanel onBack={() => setView('avatar')} />
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.inkAPI.getConfig('openai_api_key').then((key) => {
      if (key) setApiKey(key)
    })
    window.inkAPI.getConfig('openai_model').then((m) => {
      if (m) setModel(m)
    })
  }, [])

  async function handleSave() {
    await window.inkAPI.configureProvider(apiKey, model)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-form">
      <label>
        OpenAI API Key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </label>
      <label>
        Model
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        </select>
      </label>
      <button className="settings-save-btn" onClick={handleSave}>
        {saved ? '已保存' : '保存设置'}
      </button>
      <button className="settings-back-btn" onClick={onBack}>
        返回
      </button>
    </div>
  )
}
