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
import { BUILTIN_BODY_DESCRIPTOR } from '../core/avatar/bodies'
import { BuiltinFace } from './avatar/adapters/builtinAdapter'
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

/** IPC 超时护栏：调用挂死（主进程不响应）时按失败处理，绝不把用户锁在黑屏 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then((v) => { clearTimeout(t); resolve(v) })
      .catch(() => { clearTimeout(t); resolve(null) })
  })
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('desktop')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pet' | 'panel'>('pet')
  const [panel, setPanel] = useState<Panel>(null)
  /** 渲染进程第二次崩溃后主进程强制进入的 safe mode：只渲染内置「砚」 */
  const [safeMode, setSafeMode] = useState(false)
  /** 首次启动欢迎动画：砚灵正在诞生…（纯展示，绝不阻塞） */
  const [birth, setBirth] = useState(false)
  const birthTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  /** 刷新身体库 + 恢复当前身体（换身体不换灵魂）—— 挂死按失败处理，绝不锁住设置 */
  const refreshBodies = useCallback(async () => {
    const result = await withTimeout(Promise.all([
      window.inkAPI.listBodies(),
      window.inkAPI.getCurrentBodyId()
    ]), 4000)
    if (!result) return
    const [bodies, currentId] = result
    setBodies(bodies)
    const current = bodies.find((b: AvatarDescriptor) => b.id === currentId) ?? bodies[0] ?? null
    setCurrentBody(current)
  }, [setBodies, setCurrentBody])

  const handleChangeBody = useCallback(async (id: string) => {
    const r = await window.inkAPI.setCurrentBody(id)
    if (r.success && r.body) {
      setCurrentBody(r.body)
    }
    return r.success
  }, [setCurrentBody])

  // Init — 首次启动流程：先显示砚灵，后台再初始化 AI。
  // 任何一步失败（含 IPC 挂死）都不阻塞「看到砚灵」。
  useEffect(() => {
    let cancelled = false

    async function restoreBackgroundState() {
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
    }

    async function init() {
      // 阶段 0：安全模式恢复（主进程持久标志 —— reload 后依然生效）
      try {
        const sm = await withTimeout(window.inkAPI.getSafeMode(), 2000)
        if (sm && !cancelled) {
          setSafeMode(true)
          setCurrentBody(BUILTIN_BODY_DESCRIPTOR)
        }
      } catch {}

      // 阶段 1：最快路径决定首屏（新用户向导 / 老用户桌宠）
      try {
        const result = await withTimeout(Promise.all([
          window.inkAPI.hasModel(),
          window.inkAPI.getConfig('first_launch')
        ]), 4000)
        if (result && !cancelled) {
          const [hasModel, firstLaunch] = result
          if (!hasModel && firstLaunch !== 'false') {
            await window.inkAPI.setPanelMode()
            if (cancelled) return
            setMode('panel'); setScreen('wizard'); setLoading(false); return
          }
        }
      } catch {}

      // 阶段 2：加载默认身体 → 显示砚灵（4s 超时护栏；失败 → 内置「砚」兜底）
      try {
        const result = await withTimeout(Promise.all([
          window.inkAPI.listBodies(),
          window.inkAPI.getCurrentBodyId()
        ]), 4000)
        if (result && !cancelled) {
          const [bodies, currentId] = result
          setBodies(bodies)
          const current = bodies.find((b: AvatarDescriptor) => b.id === currentId) ?? bodies[0] ?? null
          setCurrentBody(current)
        }
      } catch {}
      if (cancelled) return
      setLoading(false)

      // 阶段 3：后台初始化 AI 状态（历史/模型信息/名字）—— 永不阻塞砚灵
      void restoreBackgroundState()
    }

    init()
    return () => { cancelled = true }
  }, [setBodies, setCurrentBody, setMessages, setModelInfo, setPetName])

  // Safe mode（主进程：渲染进程第二次崩溃后触发）→ 强制内置「砚」，不再加载重资产
  useEffect(() => {
    const unsub = window.inkAPI.onSafeMode(() => {
      setSafeMode(true)
      setCurrentBody(BUILTIN_BODY_DESCRIPTOR)
    })
    return unsub
  }, [setCurrentBody])

  // 清理诞生动画计时器
  useEffect(() => () => {
    if (birthTimer.current) clearTimeout(birthTimer.current)
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
  const handleBackToPet = useCallback(() => {
    // 先切透明桌宠视图（下一帧才动窗口），否则面板会以完整尺寸闪现到桌宠位置
    setMode('pet')
    requestAnimationFrame(() => { window.inkAPI.setPetMode() })
  }, [])

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
          : (r.error || '砚灵暂时联系不上它的大脑。你可以检查一下 AI 设置。')
        appendAssistantChunk(msg)
        finishAssistantMessage(); setExpression('sad')
        transition('failed')
      }
    } catch {
      appendAssistantChunk('\u7814\u7075\u6682\u65f6\u8054\u7cfb\u4e0d\u4e0a\u5b83\u7684\u5927\u8111\u3002\u4f60\u53ef\u4ee5\u68c0\u67e5\u4e00\u4e0b AI \u8bbe\u7f6e\u3002')
      finishAssistantMessage(); setExpression('sad')
      transition('failed')
    }
  }, [])

  const handleWizardComplete = useCallback(async () => {
    await refreshBodies()
    // 先切透明桌宠视图（下一帧才动窗口），避免向导面板闪现到桌宠位置
    setScreen('desktop')
    setMode('pet')
    requestAnimationFrame(() => { window.inkAPI.setPetMode() })
    // 砚灵诞生：首次见面向导完成后 1.4s 欢迎动画（纯展示，不阻塞任何初始化）
    setBirth(true)
    if (birthTimer.current) clearTimeout(birthTimer.current)
    birthTimer.current = setTimeout(() => setBirth(false), 1400)
  }, [refreshBodies])

  // Loading：窗口已显示但身体还没就绪 —— 直接展示内置「砚」，
  // 保证「5 秒内砚灵出现」不依赖任何 IPC（挂死/超时也不空白）
  if (loading) {
    return (
      <div className="pet-mode-root">
        <BuiltinFace size={140} onClick={handlePetClick} />
      </div>
    )
  }

  if (screen === 'wizard') {
    return (
      <div className="app-container">
        <WizardView onComplete={handleWizardComplete} />
      </div>
    )
  }

  if (mode === 'pet') {
    // 永远显示砚灵：currentBody 为空（IPC 挂死/身体列表空）→ 内置「砚」兜底
    const body = safeMode ? BUILTIN_BODY_DESCRIPTOR : (currentBody ?? BUILTIN_BODY_DESCRIPTOR)
    return (
      <ErrorBoundary fallback={
        <div className="pet-mode-root" onClick={handlePetClick} onContextMenu={handlePetContextMenu}>
          <BuiltinFace size={140} onClick={handlePetClick} />
        </div>
      }>
        <PetView body={body} expression={expression} mood={mood} activity={activity} temperament={temperament ?? undefined} onClick={handlePetClick} onContextMenu={handlePetContextMenu} />
        {birth && <div className="pet-birth">砚灵正在诞生…</div>}
      </ErrorBoundary>
    )
  }

  const exprToState: Record<string, string> = { neutral: 'idle', happy: 'happy', sad: 'sad', surprised: 'surprised', love: 'love' }
  const panelState = panel === 'chat' ? (exprToState[expression] ?? 'idle') : 'idle'
  const body = safeMode ? BUILTIN_BODY_DESCRIPTOR : (currentBody ?? BUILTIN_BODY_DESCRIPTOR)

  return (
    <div className="app-container">
      <div className="main-content">
        <div style={{ display: panel === 'chat' ? 'flex' : 'none', height: '100%' }}>
          <ErrorBoundary fallback={
            <div className="app-container" style={{ padding: 20 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>聊天面板出了点问题，已自动降级（安全模式）。</p>
              <button className="wizard-btn primary" style={{ marginTop: 12 }} onClick={handleBackToPet}>返回砚灵</button>
            </div>
          }>
            <ChatView body={body} state={panelState as any} messages={messages} isStreaming={isStreaming} activity={activity} modelInfo={modelInfo} lastRoute={lastRoute} onSend={handleSend} onBackToPet={handleBackToPet} onOpenSettings={() => setPanel('settings')} active={panel === 'chat'} petName={petName} />
          </ErrorBoundary>
        </div>
        <div style={{ display: panel === 'settings' ? 'block' : 'none', height: '100%' }}>
          <ErrorBoundary>
            <SettingsView bodies={bodies} currentBodyId={body.id} onChangeBody={handleChangeBody} onRefreshBodies={refreshBodies} onBack={() => setPanel('chat')} onBackToPet={handleBackToPet} safeMode={safeMode} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
