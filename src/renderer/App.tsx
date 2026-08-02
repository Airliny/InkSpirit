import { useState, useEffect, useCallback, useRef } from 'react'
import { useChatStore } from './stores/chatStore'
import { useAvatarStore } from './stores/avatarStore'
import { ChatView } from './views/ChatView'
import { SettingsView } from './views/SettingsView'
import { WizardView } from './views/WizardView'
import { PetView } from './views/PetView'
import type { AvatarDescriptor, BodyModifiers } from '../core/avatar/types'
import type { AvatarExpression } from './stores/avatarStore'
import { computeTemperament } from '../core/avatar/expressionLayer'
import { registerDefaultAdapters } from './avatar/adapters'
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

// 身体适配器注册一次（新增格式在这里加一行）
registerDefaultAdapters()

export default function App() {
  const [screen, setScreen] = useState<Screen>('desktop')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pet' | 'panel'>('pet')
  const [panel, setPanel] = useState<Panel>(null)
  const {
    messages, isStreaming, addUserMessage, appendAssistantChunk, finishAssistantMessage, setMessages
  } = useChatStore()
  const { expression, setExpression, bodies, currentBody, setBodies, setCurrentBody } = useAvatarStore()
  const [mood, setMood] = useState('neutral')
  const [modelInfo, setModelInfo] = useState<{ provider: string; model: string; localModel: string | null }>({ provider: 'openai', model: '', localModel: null })
  const [lastRoute, setLastRoute] = useState<'local' | 'cloud' | null>(null)
  const [activity, setActivity] = useState<CompanionActivity>('idle')
  const [petName, setPetName] = useState('')
  const [temperament, setTemperament] = useState<BodyModifiers | null>(null)
  /** 最近一次主动行为（说话/想法）时间——用户回应它 = 高质量互动 */
  const lastProactiveAt = useRef(0)

  // Body Expression Layer：长期关系/人格 → 身体气质（约 5 分钟刷新一次）
  useEffect(() => {
    async function loadTemperament() {
      try {
        const s = await window.inkAPI.getAgentState() as {
          personality?: Record<string, number>
          relationship?: { trust?: number; familiarity?: number; affection?: number; intimacy?: number; understanding?: number }
        }
        const rel = s.relationship ?? {}
        setTemperament(computeTemperament({
          understanding: rel.understanding ?? 0,
          attachment: Math.max(rel.affection ?? 0, rel.intimacy ?? 0),
          trust: rel.trust ?? 0,
          warmth: s.personality?.warmth ?? 0
        }))
      } catch {}
    }
    loadTemperament()
    const t = setInterval(loadTemperament, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

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

  /** 刷新身体库 + 恢复当前身体（换身体不换灵魂） */
  const refreshBodies = useCallback(async () => {
    try {
      const [bodies, currentId] = await Promise.all([
        window.inkAPI.listBodies(),
        window.inkAPI.getCurrentBodyId()
      ])
      setBodies(bodies)
      const current = bodies.find((b: AvatarDescriptor) => b.id === currentId) ?? bodies[0] ?? null
      setCurrentBody(current)
    } catch {}
  }, [setBodies, setCurrentBody])

  const handleChangeBody = useCallback(async (id: string) => {
    const r = await window.inkAPI.setCurrentBody(id)
    if (r.success && r.body) {
      setCurrentBody(r.body)
    }
    return r.success
  }, [setCurrentBody])

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
      } catch {}

      await refreshBodies()
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
  }, [refreshBodies])

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
    const u6 = window.inkAPI.onPetSpeak(({ action }) => {
      // 主动表达（关心/问候/回忆）→ 用户之后回应 = 高质量互动
      if (action !== 'normal') lastProactiveAt.current = Date.now()
    })
    const u7 = window.inkAPI.onPetThought(() => {
      lastProactiveAt.current = Date.now()
    })
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7() }
  }, [transition])

  const handlePetClick = useCallback(() => { window.inkAPI.setPanelMode(); setPanel('chat') }, [])
  const handlePetContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); window.inkAPI.showPetMenu() }, [])
  const handleBackToPet = useCallback(() => { window.inkAPI.setPetMode() }, [])

  const handleSend = useCallback(async (message: string) => {
    addUserMessage(message); setExpression('happy')
    transition('user-sent') // idle → listening → thinking（身体开始"注意你"）
    // Interaction Quality：难过时被安慰 / 回应主动行为 → 高质量互动
    if (expression === 'sad') {
      window.inkAPI.addInteraction('comfort').catch(() => {})
    } else if (Date.now() - lastProactiveAt.current < 5 * 60 * 1000) {
      window.inkAPI.addInteraction('respond').catch(() => {})
    }
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
    await refreshBodies()
    setScreen('desktop'); window.inkAPI.setPetMode()
  }, [refreshBodies])

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
        {currentBody ? (
          <PetView body={currentBody} expression={expression} mood={mood} activity={activity} temperament={temperament ?? undefined} onClick={handlePetClick} onContextMenu={handlePetContextMenu} />
        ) : (
          <div className="pet-mode-root" />
        )}
      </div>
    )
  }

  const exprToState: Record<string, string> = { neutral: 'idle', happy: 'happy', sad: 'sad', surprised: 'surprised', love: 'love' }
  const panelState = panel === 'chat' ? (exprToState[expression] ?? 'idle') : 'idle'

  return (
    <div className="app-container">
      <div className="main-content">
        <div style={{ display: panel === 'chat' ? 'flex' : 'none', height: '100%' }}>
          {currentBody && (
            <ChatView body={currentBody} state={panelState as any} messages={messages} isStreaming={isStreaming} activity={activity} modelInfo={modelInfo} lastRoute={lastRoute} onSend={handleSend} onBackToPet={handleBackToPet} onOpenSettings={() => setPanel('settings')} active={panel === 'chat'} petName={petName} />
          )}
        </div>
        <div style={{ display: panel === 'settings' ? 'block' : 'none', height: '100%' }}>
          <ErrorBoundary>
            <SettingsView bodies={bodies} currentBodyId={currentBody?.id ?? null} onChangeBody={handleChangeBody} onRefreshBodies={refreshBodies} onBack={() => setPanel('chat')} onBackToPet={handleBackToPet} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
