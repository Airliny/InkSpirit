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
import {
  reduceActivity,
  LISTENING_MS,
  THINKING_TIMEOUT_MS,
  AFTER_SPEAK_MS,
  ERROR_MS,
  type CompanionActivity,
  type ChatActivityEvent
} from '../core/chatActivity'
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
  const [activity, setActivity] = useState<CompanionActivity>('idle')
  const [petName, setPetName] = useState('')

  // M3: activity timers — the body only reflects the real pipeline, and it
  // NEVER stays in thinking forever (slow model / network hang → recover)
  useEffect(() => {
    if (activity === 'listening') {
      const t = setTimeout(() => setActivity(reduceActivity(activity, 'listen-timeout')), LISTENING_MS)
      return () => clearTimeout(t)
    }
    if (activity === 'thinking') {
      const t = setTimeout(() => setActivity(reduceActivity(activity, 'thinking-timeout')), THINKING_TIMEOUT_MS)
      return () => clearTimeout(t)
    }
    if (activity === 'afterSpeak') {
      const t = setTimeout(() => setActivity(reduceActivity(activity, 'after-speak-done')), AFTER_SPEAK_MS)
      return () => clearTimeout(t)
    }
    if (activity === 'error') {
      const t = setTimeout(() => setActivity(reduceActivity(activity, 'error-recovered')), ERROR_MS)
      return () => clearTimeout(t)
    }
  }, [activity])

  const transition = useCallback((event: ChatActivityEvent) => {
    setActivity((prev) => reduceActivity(prev, event))
  }, [])

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
      try {
        const name = await window.inkAPI.getConfig('pet_name')
        if (name) setPetName(name)
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
    const u1 = window.inkAPI.onChatChunk((chunk) => {
      appendAssistantChunk(chunk)
      // First token arrives → the pet is speaking (body syncs with the stream)
      transition('first-token')
    })
    const u2 = window.inkAPI.onChatDone(() => {
      finishAssistantMessage(); setExpression('neutral')
      transition('completed')
    })
    const u3 = window.inkAPI.onNavigate((page: string) => {
      if (page === 'settings') { setScreen('desktop'); setMode('panel'); setPanel('settings') }
      if (page === 'chat') { setScreen('desktop'); setMode('panel'); setPanel('chat') }
    })
    const u4 = window.inkAPI.onPetExpression(({ expression: expr }) => setExpression(expr as AvatarExpression))
    const u5 = window.inkAPI.onPetMood(({ mood: m }) => setMood(m))
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [transition])

  const handlePetClick = useCallback(() => { window.inkAPI.setPanelMode(); setPanel('chat') }, [])
  const handlePetContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); window.inkAPI.showPetMenu() }, [])
  const handleBackToPet = useCallback(() => { window.inkAPI.setPetMode() }, [])

  const handleSend = useCallback(async (message: string) => {
    addUserMessage(message); setExpression('happy')
    transition('user-sent') // idle → listening → thinking（身体开始"注意你"）
    try {
      const r = await window.inkAPI.chat(message)
      if (r.route === 'local' || r.route === 'cloud') setLastRoute(r.route)
      if (!r.success) {
        const msg = r.budgetBlocked
          ? '预算已用完…我们先用本地模型聊天吧？'
          : (r.error || '抱歉，我暂时无法回应...')
        appendAssistantChunk(msg)
        finishAssistantMessage(); setExpression('sad')
        transition('failed')
      }
    } catch {
      appendAssistantChunk('\u62b1\u6b49\uff0c\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u5e94...')
      finishAssistantMessage(); setExpression('sad')
      transition('failed')
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
        <PetView modelSource={modelSource} expression={expression} mood={mood} activity={activity} onClick={handlePetClick} onContextMenu={handlePetContextMenu} />
      </div>
    )
  }

  const exprToState: Record<string, string> = { neutral: 'idle', happy: 'happy', sad: 'sad', surprised: 'surprised', love: 'love' }
  const panelState = panel === 'chat' ? (exprToState[expression] ?? 'idle') : 'idle'

  return (
    <div className="app-container">
      <div className="main-content">
        <div style={{ display: panel === 'chat' ? 'flex' : 'none', height: '100%' }}>
          <ChatView modelSource={modelSource} state={panelState as any} messages={messages} isStreaming={isStreaming} activity={activity} modelInfo={modelInfo} lastRoute={lastRoute} onSend={handleSend} onBackToPet={handleBackToPet} onOpenSettings={() => setPanel('settings')} active={panel === 'chat'} petName={petName} />
        </div>
        <div style={{ display: panel === 'settings' ? 'block' : 'none', height: '100%' }}>
          <ErrorBoundary>
            <SettingsView modelSource={modelSource} onModelSourceChange={setModelSource} onBack={() => setPanel('chat')} onBackToPet={handleBackToPet} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
