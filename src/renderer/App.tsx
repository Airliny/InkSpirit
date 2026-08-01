import { useState, useEffect, useCallback } from 'react'
import { useChatStore } from './stores/chatStore'
import { useAvatarStore } from './stores/avatarStore'
import { ChatView } from './views/ChatView'
import { SettingsView } from './views/SettingsView'
import { WizardView } from './views/WizardView'
import { PetView } from './views/PetView'
import type { SpriteSource, ModelSource } from './components/avatar/modelTypes'
import type { AvatarExpression } from './stores/avatarStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import './App.css'

type Screen = 'wizard' | 'desktop'
type Panel = 'chat' | 'settings' | null

export default function App() {
  const [screen, setScreen] = useState<Screen>('desktop')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pet' | 'panel'>('pet')
  const [panel, setPanel] = useState<Panel>(null)
  const [modelSource, setModelSource] = useState<ModelSource>({ type: 'sprites', sprites: {} })
  const {
    messages, isStreaming, addUserMessage, appendAssistantChunk, finishAssistantMessage, setMessages
  } = useChatStore()
  const { expression, setExpression } = useAvatarStore()
  const [mood, setMood] = useState('neutral')
  const [modelInfo, setModelInfo] = useState<{ provider: string; model: string; localModel: string | null }>({ provider: 'openai', model: '', localModel: null })
  const [lastRoute, setLastRoute] = useState<'local' | 'cloud' | null>(null)

  // Init
  useEffect(() => {
    async function init() {
      try {
        const [hasModel, firstLaunch] = await Promise.all([
          window.inkAPI.hasModel(),
          window.inkAPI.getConfig('first_launch')
        ])
        if (!hasModel && firstLaunch !== 'false') {
          await window.inkAPI.setPanelMode()
          setMode('panel'); setScreen('wizard'); setLoading(false); return
        }

        const modelType = await window.inkAPI.getModelType()
        if (modelType === 'live2d') {
          const l2dPath = await window.inkAPI.getLive2DPath()
          if (l2dPath) {
            setModelSource({ type: 'live2d', live2d: { type: 'live2d', modelPath: l2dPath } })
          }
        } else {
          const savedSprites = await window.inkAPI.getModelSprites()
          const source: SpriteSource = {}
          for (const [key, val] of Object.entries(savedSprites)) {
            if (val) (source as any)[key] = val
          }
          setModelSource({ type: 'sprites', sprites: source })
        }
      } catch {}
      // Restore the most recent conversation so the pet remembers
      try {
        const history = await window.inkAPI.getChatHistory()
        if (history.length > 0) setMessages(history as any)
      } catch {}
      try {
        const info = await window.inkAPI.getModelInfo()
        setModelInfo(info)
      } catch {}
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    const unsub = window.inkAPI.onWindowMode((newMode) => {
      setMode(newMode)
      if (newMode === 'pet') setPanel(null)
      // Refresh model info whenever the panel opens so config changes show up
      if (newMode === 'panel') {
        window.inkAPI.getModelInfo().then(setModelInfo).catch(() => {})
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onChatChunk((chunk) => appendAssistantChunk(chunk))
    const u2 = window.inkAPI.onChatDone(() => { finishAssistantMessage(); setExpression('neutral') })
    const u3 = window.inkAPI.onNavigate((page: string) => {
      if (page === 'settings') { setScreen('desktop'); setMode('panel'); setPanel('settings') }
      if (page === 'chat') { setScreen('desktop'); setMode('panel'); setPanel('chat') }
    })
    const u4 = window.inkAPI.onPetExpression(({ expression: expr }) => setExpression(expr as AvatarExpression))
    const u5 = window.inkAPI.onPetMood(({ mood: m }) => setMood(m))
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  const handlePetClick = useCallback(() => { window.inkAPI.setPanelMode(); setPanel('chat') }, [])
  const handlePetContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); window.inkAPI.showPetMenu() }, [])
  const handleBackToPet = useCallback(() => { window.inkAPI.setPetMode() }, [])

  const handleSend = useCallback(async (message: string) => {
    addUserMessage(message); setExpression('happy')
    try {
      const r = await window.inkAPI.chat(message)
      if (r.route === 'local' || r.route === 'cloud') setLastRoute(r.route)
      if (!r.success) {
        const msg = r.budgetBlocked
          ? '预算已用完…我们先用本地模型聊天吧？'
          : (r.error || '抱歉，我暂时无法回应...')
        appendAssistantChunk(msg)
        finishAssistantMessage(); setExpression('sad')
      }
    } catch {
      appendAssistantChunk('\u62b1\u6b49\uff0c\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u5e94...')
      finishAssistantMessage(); setExpression('sad')
    }
  }, [])

  const handleWizardComplete = useCallback(async () => {
    const modelType = await window.inkAPI.getModelType()
    if (modelType === 'live2d') {
      const l2dPath = await window.inkAPI.getLive2DPath()
      if (l2dPath) setModelSource({ type: 'live2d', live2d: { type: 'live2d', modelPath: l2dPath } })
    } else {
      const savedSprites = await window.inkAPI.getModelSprites()
      const source: SpriteSource = {}
      for (const [key, val] of Object.entries(savedSprites)) {
        if (val) (source as any)[key] = val
      }
      setModelSource({ type: 'sprites', sprites: source })
    }
    setScreen('desktop'); window.inkAPI.setPetMode()
  }, [])

  if (loading) return <div className="app-container" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)' }} />

  if (screen === 'wizard') {
    return (
      <div className="app-container">
        <WizardView onComplete={handleWizardComplete} />
      </div>
    )
  }

  if (mode === 'pet') {
    return (
      <div className="pet-mode-root">
        <PetView modelSource={modelSource} expression={expression} mood={mood} onClick={handlePetClick} onContextMenu={handlePetContextMenu} />
      </div>
    )
  }

  const exprToState: Record<string, string> = { neutral: 'idle', happy: 'happy', sad: 'sad', surprised: 'surprised', love: 'love' }
  const panelState = panel === 'chat' ? (exprToState[expression] ?? 'idle') : 'idle'

  return (
    <div className="app-container">
      <div className="title-bar">
        <span className="title-text">InkSpirit</span>
        <div className="title-actions">
          <button className="title-btn" onClick={() => setPanel(panel === 'settings' ? 'chat' : 'settings')}>
            {panel === 'settings' ? '\u2709' : '\u2699'}
          </button>
          <button className="title-btn" onClick={handleBackToPet}>&#8722;</button>
        </div>
      </div>
      <div className="main-content">
        <div style={{ display: panel === 'chat' ? 'flex' : 'none', height: '100%' }}>
          <ChatView modelSource={modelSource} state={panelState as any} messages={messages} isStreaming={isStreaming} modelInfo={modelInfo} lastRoute={lastRoute} onSend={handleSend} onHeaderClick={handleBackToPet} />
        </div>
        <div style={{ display: panel === 'settings' ? 'block' : 'none', height: '100%' }}>
          <ErrorBoundary>
            <SettingsView modelSource={modelSource} onModelSourceChange={setModelSource} onBack={() => setPanel('chat')} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
