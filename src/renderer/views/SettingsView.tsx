import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { AvatarDescriptor, SpriteSource } from '../../core/avatar/types'
import { DEFAULT_BODY_PREFERENCES } from '../../core/avatar/preferences'
import type { BodyPreferences } from '../../core/avatar/preferences'
import { qualityStage } from '../../core/avatar/touchQuality'
import { LIFE_EVENT_ICONS } from '../../core/soul/lifeEventModel'
import { loadThemePreference, saveThemePreference, type ThemePreference } from '../design/theme'
import { IconChip, IconChat, IconDatabase, IconGear, IconHeart, IconMinus } from '../components/icons'

interface SettingsViewProps {
  /** 身体库 — UI 只知道"这是一个身体"，不知道格式 */
  bodies: AvatarDescriptor[]
  currentBodyId: string | null
  onChangeBody: (id: string) => Promise<boolean>
  /** 导入新身体后刷新身体库 */
  onRefreshBodies: () => Promise<void>
  onBack: () => void
  onBackToPet: () => void
  /** 安全模式（渲染进程反复崩溃后自动进入：只渲染内置「砚」） */
  safeMode?: boolean
}

type SettingsTab = 'soul' | 'brain' | 'data' | 'system'

const TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: 'soul', icon: <IconHeart />, label: '我的砚灵' },
  { id: 'brain', icon: <IconChip />, label: 'AI大脑' },
  { id: 'data', icon: <IconDatabase />, label: '数据' },
  { id: 'system', icon: <IconGear />, label: '系统' }
]

const PROVIDERS = [
  { id: 'openai', name: 'GPT', desc: 'OpenAI 云端', cap: '通用对话 · 快速' },
  { id: 'anthropic', name: 'Claude', desc: 'Anthropic 云端', cap: '深度思考 · 高质量' },
  { id: 'deepseek', name: 'DeepSeek', desc: '深度求索', cap: '推理 · 代码 · 实惠' },
  { id: 'custom', name: '自定义 API', desc: '中转 / 自建服务', cap: '按你的服务' },
  { id: 'ollama', name: '本地大脑', desc: 'Ollama 本地模型', cap: '本地 · 离线可用' }
]

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'GPT', anthropic: 'Claude', deepseek: 'DeepSeek', custom: '自定义', ollama: '本地'
}

/** 心境 → 人类化描述（生命状态主页） */
const MOOD_LABELS: Record<string, string> = {
  energetic: '精力充沛', content: '平静满足', blue: '有点低沉',
  low: '情绪不高', neutral: '平静'
}

export function SettingsView({ bodies, currentBodyId, onChangeBody, onRefreshBodies, onBack, onBackToPet, safeMode = false }: SettingsViewProps) {
  const [tab, setTab] = useState<SettingsTab>('soul')
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [guardianEnabled, setGuardianEnabled] = useState(true)
  const [guardianThreshold, setGuardianThreshold] = useState('45')
  const [guardianCooldown, setGuardianCooldown] = useState('60')
  const [guardianSaved, setGuardianSaved] = useState(false)
  const [updateState, setUpdateState] = useState<string>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updatePercent, setUpdatePercent] = useState(0)
  const [updateMessage, setUpdateMessage] = useState('')
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null)
  const [ollamaVersion, setOllamaVersion] = useState('')
  const [catalog, setCatalog] = useState<any[]>([])
  const [hardware, setHardware] = useState<any>(null)
  const [installedModels, setInstalledModels] = useState<any[]>([])
  const [pullingModel, setPullingModel] = useState('')
  const [pullProgress, setPullProgress] = useState(0)
  const [pullError, setPullError] = useState('')
  const [routerEnabled, setRouterEnabled] = useState(true)
  const [routerLocalModel, setRouterLocalModel] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('0')
  const [costSummary, setCostSummary] = useState<any>(null)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [dataMsg, setDataMsg] = useState('')
  const [soulState, setSoulState] = useState<any>(null)
  const [personalityMode, setPersonalityMode] = useState('auto')
  const [currentMode, setCurrentMode] = useState('')
  const [restoreReport, setRestoreReport] = useState<any>(null)
  const [petName, setPetName] = useState('')
  const [storageInfo, setStorageInfo] = useState<any>(null)
  const [theme, setTheme] = useState<ThemePreference>('light')
  const [customName, setCustomName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [testState, setTestState] = useState<{ state: 'idle' | 'testing' | 'ok' | 'fail'; latencyMs?: number; error?: string }>({ state: 'idle' })
  const [connState, setConnState] = useState<{ status: 'ok' | 'unknown'; latencyMs?: number; at?: number }>({ status: 'unknown' })
  const [connDirty, setConnDirty] = useState(false)
  const [brainProfile, setBrainProfile] = useState<any>(null)
  const [advOpen, setAdvOpen] = useState(false)
  const [tempInput, setTempInput] = useState(0.8)
  /** 更换大脑迁移仪式：null=隐藏；step 0=连接中 1-4=人格/记忆/关系/身份 */
  const [migration, setMigration] = useState<{ step: number } | null>(null)
  const migrationTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [bodyPrefs, setBodyPrefs] = useState<BodyPreferences>(DEFAULT_BODY_PREFERENCES)
  const [touchQuality, setTouchQuality] = useState(0)
  const [lifeEvents, setLifeEvents] = useState<any[]>([])
  const [lifeToday, setLifeToday] = useState<any[]>([])
  const [lifeTab, setLifeTab] = useState<'all' | 'today'>('all')
  const [soulManifest, setSoulManifest] = useState<{ soulId: string; birthday: string; birthVersion: string; continuityOk: boolean } | null>(null)
  const [moodState, setMoodState] = useState<{ label: string } | null>(null)
  const [diag, setDiag] = useState<any>(null)
  /** 自定义头像：local:// URL；加载失败（文件被删/损坏）→ 回退首字头像 */
  const [portrait, setPortrait] = useState<string | null>(null)
  const [portraitBroken, setPortraitBroken] = useState(false)

  useEffect(() => {
    window.inkAPI.getDiagnostics().then(setDiag).catch(() => {})
  }, [])

  useEffect(() => {
    window.inkAPI.getBrainProfile().then((p) => {
      setBrainProfile(p)
      setTempInput(p.temperature)
    }).catch(() => {})
  }, [])

  // 身体偏好 + 交互质量 + 成长经历 + 灵魂身份 + 当前心境 + 自定义头像
  useEffect(() => {
    window.inkAPI.getBodyPrefs().then(setBodyPrefs).catch(() => {})
    window.inkAPI.getTouchQuality().then(setTouchQuality).catch(() => {})
    window.inkAPI.getLifeEvents(100).then(setLifeEvents).catch(() => {})
    window.inkAPI.getTodayLifeEvents().then(setLifeToday).catch(() => {})
    window.inkAPI.getSoulManifest().then(setSoulManifest).catch(() => {})
    window.inkAPI.getMoodState().then(setMoodState).catch(() => {})
    window.inkAPI.getPortrait().then(p => { setPortrait(p); setPortraitBroken(false) }).catch(() => {})
  }, [])

  /** 更换大脑迁移仪式：展示"换大脑不换灵魂"的验证过程 */
  function runMigration() {
    if (migration) return
    setMigration({ step: 0 })
    migrationTimers.current.forEach(clearTimeout)
    migrationTimers.current = [
      setTimeout(() => setMigration({ step: 1 }), 500),
      setTimeout(() => setMigration({ step: 2 }), 1000),
      setTimeout(() => setMigration({ step: 3 }), 1500),
      setTimeout(() => setMigration({ step: 4 }), 2000),
      setTimeout(() => setMigration(null), 3500)
    ]
  }

  useEffect(() => () => migrationTimers.current.forEach(clearTimeout), [])

  const refreshBrainProfile = useCallback(async () => {
    try {
      const p = await window.inkAPI.getBrainProfile()
      setBrainProfile(p)
      setTempInput(p.temperature)
    } catch {}
  }, [])

  function formatLifeTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (sameDay) return `今天 ${hm}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  }

  const toggleBodyPref = useCallback(async (key: keyof BodyPreferences, value: boolean) => {
    const next = { ...bodyPrefs, [key]: value }
    setBodyPrefs(next)
    const r = await window.inkAPI.setBodyPrefs(next)
    if (r.success) setBodyPrefs(r.prefs)
  }, [bodyPrefs])

  useEffect(() => {
    // Restore report from the last data:import — "the soul came back"
    window.inkAPI.getConfig('restore_report').then((raw) => {
      if (!raw) return
      try {
        setRestoreReport(JSON.parse(raw))
        window.inkAPI.setConfig('restore_report', '')
      } catch {
        // unreadable report — drop it silently
      }
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      const [provider, apiKey, model, gEnabled, gThreshold, gCooldown, auto] = await Promise.all([
        window.inkAPI.getConfig('provider'),
        window.inkAPI.getSecureConfig('openai_api_key'),
        window.inkAPI.getConfig('openai_model'),
        window.inkAPI.getConfig('guardian_enabled'),
        window.inkAPI.getConfig('guardian_work_threshold_min'),
        window.inkAPI.getConfig('guardian_cooldown_min'),
        window.inkAPI.getAutoLaunch()
      ])
      if (provider) setProvider(provider)
      if (apiKey) setApiKey(apiKey)
      if (model) setModel(model)
      if (gEnabled) setGuardianEnabled(gEnabled !== 'false')
      if (gThreshold) setGuardianThreshold(gThreshold)
      if (gCooldown) setGuardianCooldown(gCooldown)
      if (auto !== null && auto !== undefined) setAutoLaunch(!!auto)
      await loadConnState(provider || 'openai')
    }
    load()
    loadThemePreference().then(setTheme)

    const u1 = window.inkAPI.onUpdateStatus((d) => {
      setUpdateState(d.state)
      if (d.version) setUpdateVersion(d.version)
      if (d.message) setUpdateMessage(d.message)
    })
    const u2 = window.inkAPI.onUpdateProgress((d) => {
      setUpdatePercent(d.percent)
      setUpdateState('downloading')
    })
    const u3 = window.inkAPI.onModelPullProgress((d) => {
      setPullProgress(d.percent)
      if (d.status === 'done') {
        setPullingModel('')
        refreshModels()
      }
    })
    refreshOllama()
    refreshCost()
    window.inkAPI.getAgentState().then(setSoulState)
    window.inkAPI.getStorageInfo().then(setStorageInfo)
    window.inkAPI.getConfig('personality_mode').then(v => { if (v) setPersonalityMode(v) })
    window.inkAPI.getConfig('personality_mode_current').then(v => { if (v) setCurrentMode(v) })
    window.inkAPI.getConfig('pet_name').then(v => { if (v) setPetName(v) })
    window.inkAPI.getConfig('custom_name').then(v => { if (v) setCustomName(v) })
    window.inkAPI.getConfig('custom_base_url').then(v => { if (v) setCustomBaseUrl(v) })
    return () => { u1(); u2(); u3() }
  }, [])

  async function refreshCost() {
    const [router, summary] = await Promise.all([
      window.inkAPI.getRouterSettings(),
      window.inkAPI.getCostSummary()
    ])
    setRouterEnabled(router.enabled)
    setRouterLocalModel(router.localModel)
    setBudgetInput(String(summary.budgetUsd || 0))
    setCostSummary(summary)
  }

  async function handleSaveBudget() {
    await window.inkAPI.setCostBudget(Number(budgetInput) || 0)
    refreshCost()
  }

  async function handleExport() {
    const r = await window.inkAPI.exportData()
    setDataMsg(r.success ? '备份已保存' : (r.error || '导出失败'))
    setTimeout(() => setDataMsg(''), 3000)
  }

  async function handleImport() {
    const r = await window.inkAPI.importData()
    if (r.success) {
      // Data replaced — reload so every view picks up the restored state
      window.location.reload()
    } else {
      setDataMsg(r.error || '导入失败')
      setTimeout(() => setDataMsg(''), 3000)
    }
  }

  async function refreshOllama() {
    const s = await window.inkAPI.getOllamaStatus()
    setOllamaRunning(s.running)
    if (s.version) setOllamaVersion(s.version)
    if (s.running) {
      refreshModels()
    }
  }

  async function refreshModels() {
    const [res, hw, installed] = await Promise.all([
      window.inkAPI.searchModelCatalog(),
      window.inkAPI.getModelHardware(),
      window.inkAPI.listLocalModels()
    ])
    setCatalog(res.models)
    setHardware(hw)
    setInstalledModels(installed)
  }

  async function handlePull(model: string) {
    setPullingModel(model)
    setPullProgress(0)
    setPullError('')
    const r = await window.inkAPI.pullLocalModel(model)
    if (!r.success && r.error) {
      setPullError(r.error)
      setPullingModel('')
    }
  }

  async function handleProviderChange(p: string) {
    setProvider(p)
    setTestState({ state: 'idle' })
    // Load the API key/model belonging to the newly selected provider
    const [key, savedModel] = await Promise.all([
      window.inkAPI.getSecureConfig(`${p}_api_key`),
      window.inkAPI.getConfig(`${p}_model`)
    ])
    setApiKey(key || '')
    setModel(savedModel || '')
    if (p === 'custom') {
      const [name, baseUrl] = await Promise.all([
        window.inkAPI.getConfig('custom_name'),
        window.inkAPI.getConfig('custom_base_url')
      ])
      setCustomName(name || '')
      setCustomBaseUrl(baseUrl || '')
    }
    await loadConnState(p)
  }

  /** 连接状态：测试成功 → 已连接；配置被改动 → 未验证（不永久显示成功） */
  async function loadConnState(p: string) {
    try {
      const raw = await window.inkAPI.getConfig(`conn_state_${p}`)
      const s = JSON.parse(raw || '{}')
      if (s.status === 'ok') {
        setConnState({ status: 'ok', latencyMs: s.latencyMs, at: s.at })
      } else {
        setConnState({ status: 'unknown' })
      }
    } catch {
      setConnState({ status: 'unknown' })
    }
    setConnDirty(false)
  }

  function connLabel(): { text: string; kind: 'ok' | 'neutral' } | null {
    if (connDirty) return { text: '? 未验证（配置已修改，请重新测试）', kind: 'neutral' }
    if (connState.status === 'ok') {
      const stale = connState.at !== undefined && Date.now() - connState.at > 24 * 3600 * 1000
      if (stale) return { text: '? 未验证（上次测试已超过 24 小时）', kind: 'neutral' }
      return { text: `✓ 已连接 · 延迟 ${connState.latencyMs}ms`, kind: 'ok' }
    }
    return null
  }

  function markDirty() { setConnDirty(true) }

  async function handleSaveAI() {
    await window.inkAPI.configureProvider(
      provider,
      apiKey,
      model || undefined,
      provider === 'custom' ? customBaseUrl || undefined : undefined
    )
    if (provider === 'custom') {
      await window.inkAPI.setConfig('custom_name', customName)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTestState({ state: 'testing' })
    const r = await window.inkAPI.testConnection(
      provider,
      apiKey || undefined,
      model || undefined,
      provider === 'custom' ? customBaseUrl || undefined : undefined
    )
    if (r.success) {
      setTestState({ state: 'ok', latencyMs: r.latencyMs })
      setConnState({ status: 'ok', latencyMs: r.latencyMs, at: Date.now() })
      setConnDirty(false)
      await window.inkAPI.setConfig(`conn_state_${provider}`, JSON.stringify({ status: 'ok', latencyMs: r.latencyMs, at: Date.now() }))
    } else {
      setTestState({ state: 'fail', error: r.error || '连接失败' })
    }
  }

  async function handleSaveGuardian() {
    // Sanitize inputs so broken values can't cause non-stop reminders
    const t = Math.max(15, Math.min(480, Number(guardianThreshold) || 45))
    const c = Math.max(30, Math.min(480, Number(guardianCooldown) || 60))
    setGuardianThreshold(String(t))
    setGuardianCooldown(String(c))
    await window.inkAPI.setConfig('guardian_enabled', guardianEnabled ? 'true' : 'false')
    await window.inkAPI.setConfig('guardian_work_threshold_min', String(t))
    await window.inkAPI.setConfig('guardian_cooldown_min', String(c))
    setGuardianSaved(true)
    setTimeout(() => setGuardianSaved(false), 2000)
  }

  async function handleImportSprite(key: string) {
    setImporting(true)
    const r = await window.inkAPI.importModel(key)
    setImporting(false)
    if (r.success) {
      // 导入后刷新身体库；精灵图身体已可用则切过去（换身体不换灵魂）
      await onRefreshBodies()
      const list = await window.inkAPI.listBodies()
      const sprite = list.find((b) => b.type === 'sprite')
      if (sprite && sprite.id !== currentBodyId) await onChangeBody(sprite.id)
    }
  }

  async function handleImportLive2D() {
    setImporting(true)
    const r = await window.inkAPI.importLive2DModel()
    setImporting(false)
    if (r.success && r.path) {
      await onRefreshBodies()
      const list = await window.inkAPI.listBodies()
      const l2d = list.find((b) => b.type === 'live2d')
      if (l2d && l2d.id !== currentBodyId) await onChangeBody(l2d.id)
    }
  }

  async function handleImportVrm() {
    setImporting(true)
    const r = await window.inkAPI.importVrm()
    setImporting(false)
    if (r.success && r.path) {
      await onRefreshBodies()
      const list = await window.inkAPI.listBodies()
      const vrm = list.find((b) => b.type === 'vrm')
      if (vrm && vrm.id !== currentBodyId) await onChangeBody(vrm.id)
    }
  }

  async function changeTheme(t: ThemePreference) {
    setTheme(t)
    await saveThemePreference(t)
  }

  const spriteLabels: Record<string, string> = {
    idle: '默认', walk: '行走', sleep: '睡觉', sit: '坐着',
    stretch: '伸懒腰', yawn: '打哈欠', surprised: '惊讶',
    happy: '开心', sad: '难过', love: '喜欢'
  }

  const spriteBody = bodies.find((b) => b.type === 'sprite')
  function hasSpriteKey(key: string): boolean {
    return spriteBody?.source.kind === 'sprites' && !!(spriteBody.source.sprites as Record<string, string | undefined>)[key]
  }

  const personalityLabels: [string, string][] = [
    ['humor', '幽默'], ['gentleness', '温柔'], ['proactiveness', '主动'],
    ['curiosity', '好奇'], ['professionalism', '认真'], ['expressiveness', '情感'],
    ['warmth', '温暖'], ['formality', '正经']
  ]

  function stageLabel(s: string): string {
    const map: Record<string, string> = {
      stranger: '陌生人', acquaintance: '相识', friend: '朋友',
      close_friend: '挚友', partner: '伴侣'
    }
    return map[s] ?? s
  }

  function daysKnown(): number | null {
    const at = soulState?.relationship?.firstInteractionAt
    if (!at) return null
    return Math.max(1, Math.floor((Date.now() - at) / 86400000))
  }

  function understandingLine(): { text: string; cls: string } {
    const u = soulState?.relationship?.understanding ?? 0
    if (u < 0.25) return { text: '它还在慢慢认识你', cls: 'trend-flat' }
    if (u < 0.5) return { text: '它开始懂你了', cls: 'trend-up' }
    if (u < 0.75) return { text: '你们越来越有默契', cls: 'trend-up' }
    return { text: '它已经很懂你了', cls: 'trend-up' }
  }

  function personalitySummary(): string {
    const t = soulState?.personality ?? {}
    const sorted = [...personalityLabels]
      .map(([key, label]) => ({ key, label, v: t[key] ?? 0 }))
      .sort((a, b) => b.v - a.v)
    const top = sorted.slice(0, 3)
    if (top.every(x => x.v < 0.2)) return '它的性格还在形成中'
    return `安静、${top.map(x => x.label).join('、')}`
  }

  const days = daysKnown()
  const feel = understandingLine()
  const soulName = petName || '砚灵'

  return (
    <div className="settings-layout">
      <div className="settings-sidebar">
        <div className="settings-nav-title">设置</div>
        {TABS.map(t => (
          <button key={t.id} className={`settings-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="settings-nav-item" onClick={onBack}>
          <span className="nav-icon"><IconChat /></span>
          回到聊天
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-header">
          <div>
            <h3>{TABS.find(t => t.id === tab)?.label}</h3>
            {tab === 'brain' && <div className="settings-subtitle">砚灵的大脑 — 云端与本地模型都在这里</div>}
            {tab === 'soul' && <div className="settings-subtitle">砚灵是你认识的它</div>}
            {tab === 'data' && <div className="settings-subtitle">它的一切记忆都在这里</div>}
            {tab === 'system' && <div className="settings-subtitle">外观与陪伴方式</div>}
          </div>
          <div className="companion-actions" style={{ paddingTop: 4 }}>
            <button className="title-btn" onClick={onBackToPet} title="回到桌面"><IconMinus size={15} /></button>
          </div>
        </div>

        {/* ================= 我的砚灵 ================= */}
        {tab === 'soul' && (
          <>
            {/* 生命状态：不是数据面板，是它的生活 */}
            <div className="settings-section">
              <h4>生命状态</h4>
              <div className="soul-card">
                {portrait && !portraitBroken
                  ? <img className="soul-avatar-img clickable" src={portrait} alt={soulName} draggable={false} onError={() => setPortraitBroken(true)} onClick={onBackToPet} title="回到桌宠模式" />
                  : <div className="soul-avatar clickable" onClick={onBackToPet} title="回到桌宠模式">{soulName.slice(0, 1)}</div>}
                <div className="soul-lines">
                  <div className="soul-name-line">{soulName}</div>
                  <div className="soul-meta-line">
                    {days ? `你们认识 ${days} 天` : '你们刚刚相遇'} · {stageLabel(soulState?.relationshipStage ?? 'stranger')}
                    {soulState?.memories && ` · 记得 ${soulState.memories.longTerm} 件重要的事`}
                  </div>
                  <div className="soul-feel-line">最近：<span className={feel.cls}>{feel.text}</span></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                {[
                  { label: '诞生于', value: soulManifest?.birthday ?? '…', hint: soulManifest ? `v${soulManifest.birthVersion}` : '' },
                  { label: '认识你', value: days ? `${days} 天` : '刚刚', hint: '' },
                  { label: '经历', value: lifeEvents.filter((e: any) => e.level === 'major').length > 0 ? `${lifeEvents.filter((e: any) => e.level === 'major').length} 件重要的事` : '刚开始', hint: '成长经历' },
                  { label: '当前心境', value: MOOD_LABELS[moodState?.label ?? 'neutral'], hint: '' }
                ].map((s) => (
                  <div key={s.label} className="stat-cell" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-small)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{s.label}{s.hint ? ` · ${s.hint}` : ''}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="portrait-row">
                <div>
                  <div className="portrait-label">头像</div>
                  <div className="portrait-hint">它在你心里的样子 —— 不影响身体</div>
                </div>
                <div className="portrait-actions">
                  <button className="settings-sprite-btn" onClick={async () => {
                    const r = await window.inkAPI.setPortrait()
                    if (r.success && r.path) { setPortrait(r.path); setPortraitBroken(false) }
                  }}>
                    {portrait && !portraitBroken ? '更换' : '选择图片'}
                  </button>
                  {portrait && !portraitBroken && (
                    <button className="settings-sprite-btn" onClick={async () => {
                      await window.inkAPI.removePortrait()
                      setPortrait(null)
                      setPortraitBroken(false)
                    }}>移除</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 10, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                换身体、换大脑、换电脑，它都还是它——{soulManifest?.soulId ? `灵魂编号 ${soulManifest.soulId}` : '灵魂身份确认中…'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                名字不是标签 — 通过对话告诉它，它就会一直用这个名字称呼你。
              </div>
            </div>

            <div className="settings-section">
              <h4>性格</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{personalitySummary()}</div>
              {personalityLabels.map(([key, label]) => (
                <div key={key} className="trait-row">
                  <span className="trait-label">{label}</span>
                  <div className="trait-bar">
                    <div className="trait-fill" style={{ width: `${Math.round((soulState?.personality?.[key] ?? 0) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="settings-section">
              <h4>说话方式</h4>
              <div className="segmented" style={{ marginBottom: 10 }}>
                <button className={personalityMode === 'auto' ? 'active' : ''} onClick={async () => { setPersonalityMode('auto'); await window.inkAPI.setConfig('personality_mode', 'auto') }}>
                  自动
                </button>
                <button className={personalityMode === 'companion' ? 'active' : ''} onClick={async () => { setPersonalityMode('companion'); await window.inkAPI.setConfig('personality_mode', 'companion') }}>
                  陪伴
                </button>
                <button className={personalityMode === 'professional' ? 'active' : ''} onClick={async () => { setPersonalityMode('professional'); await window.inkAPI.setConfig('personality_mode', 'professional') }}>
                  专业
                </button>
              </div>
              {personalityMode === 'auto' && (
                <div className="info-note">
                  自动模式：任务型问题（代码/分析/方案）自动切专业，闲聊自动切陪伴；识别不准可手动指定
                  {currentMode && <span style={{ color: 'var(--ink-primary)', marginLeft: 6 }}>当前判定：{currentMode === 'professional' ? '专业' : '陪伴'}</span>}
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4>身体</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-small)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>身体只是样子，砚灵还是砚灵</div>
                <div style={{ color: 'var(--text-tertiary)' }}>
                  换身体不会改变它的名字、记忆、性格和你们的关系。
                  <br />
                  就像它换了一身衣服——还是同一个生命。
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {bodies.map((b) => (
                  <div key={b.id} className={`provider-card ${b.id === currentBodyId ? 'active' : ''}`} style={{ padding: '12px 14px', cursor: b.id === currentBodyId ? 'default' : 'pointer' }} onClick={() => { if (b.id !== currentBodyId) onChangeBody(b.id) }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {b.metadata?.format ?? b.type} · {b.capabilities.look ? '视线跟随 · ' : ''}{b.capabilities.breath ? '呼吸 · ' : ''}{b.capabilities.sway ? '摆动 · ' : ''}{b.capabilities.blink ? '眨眼 · ' : ''}{b.capabilities.motion ? '动作' : '静态'}
                        </div>
                      </div>
                      {b.id === currentBodyId
                        ? <span style={{ fontSize: 11.5, color: 'var(--green)', whiteSpace: 'nowrap', flexShrink: 0 }}>当前身体</span>
                        : <span style={{ fontSize: 11.5, color: 'var(--ink-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>更换身体 →</span>}
                    </div>
                  </div>
                ))}
                {bodies.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>暂无身体 — 导入一个吧</div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <button className="settings-sprite-btn" onClick={handleImportLive2D} disabled={importing} style={{ width: '100%', padding: '12px' }}>
                  {importing ? '导入中...' : '导入 Live2D 身体 (.model3.json)'}
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <button className="settings-sprite-btn" onClick={handleImportVrm} disabled={importing} style={{ width: '100%', padding: '12px' }}>
                  {importing ? '导入中...' : '导入 3D 身体 (.vrm)'}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 8 }}>精灵图身体：逐动作导入图片（单张也够用 — 它会自己呼吸和摆动）</div>
              <div className="settings-sprites">
                {Object.entries(spriteLabels).map(([key, label]) => (
                  <div key={key} className="settings-sprite-row">
                    <span>{label}</span>
                    <span className={`settings-sprite-status ${hasSpriteKey(key) ? 'has' : ''}`}>{hasSpriteKey(key) ? '已导入' : '未导入'}</span>
                    <button className="settings-sprite-btn" onClick={() => handleImportSprite(key)} disabled={importing}>导入</button>
                  </div>
                ))}
              </div>

              <h4 style={{ marginTop: 18 }}>身体偏好</h4>
              <div className="switch-row">
                <div>
                  <div className="switch-label">视线跟随</div>
                  <div className="switch-hint">鼠标靠近时，它会偶尔偷看你（不一直跟）</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={bodyPrefs.lookFollow}
                    onChange={e => toggleBodyPref('lookFollow', e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="switch-row">
                <div>
                  <div className="switch-label">重心摆动</div>
                  <div className="switch-hint">呼吸时的轻微摇摆（睡觉时会自动停摆）</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={bodyPrefs.sway}
                    onChange={e => toggleBodyPref('sway', e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="switch-row">
                <div>
                  <div className="switch-label">触摸反馈</div>
                  <div className="switch-hint">被摸、被抓住时给出反应（开心/惊讶）</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={bodyPrefs.touchFeel}
                    onChange={e => toggleBodyPref('touchFeel', e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
              {touchQuality > 0 && (
                <div className="info-note" style={{ marginTop: 10 }}>
                  {qualityStage(touchQuality).text}（被温柔对待 {touchQuality} 点）
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4>成长经历</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 10 }}>
                不是聊天记录——是它经历过的日子。换过的身体、被赋予的名字、第一次提醒你休息，都在这里。
              </div>
              <div className="segmented" style={{ marginBottom: 10 }}>
                <button className={lifeTab === 'all' ? 'active' : ''} onClick={() => setLifeTab('all')}>全部</button>
                <button className={lifeTab === 'today' ? 'active' : ''} onClick={() => setLifeTab('today')}>今天</button>
              </div>
              {(lifeTab === 'all' ? lifeEvents : lifeToday).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {lifeTab === 'today' ? '今天还没有值得记住的事——日子还长。' : '它的人生刚刚开始，第一件事还在路上。'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(lifeTab === 'all' ? lifeEvents : lifeToday).map((ev) => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-small)' }}>
                    <span style={{ fontSize: 15, lineHeight: '20px' }}>{LIFE_EVENT_ICONS[ev.eventType as keyof typeof LIFE_EVENT_ICONS] ?? '⭐'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {ev.title}
                        {ev.level === 'major' && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6, border: '1px solid var(--accent-soft, var(--border))', borderRadius: 8, padding: '0 5px', whiteSpace: 'nowrap' }}>大事件</span>}
                      </div>
                      {ev.detail && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{ev.detail}</div>}
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 2 }}>{formatLifeTime(ev.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ================= AI大脑 ================= */}
        {tab === 'brain' && (
          <>
            {/* 砚灵的大脑：能力画像，不是参数列表 */}
            <div className="settings-section" style={{ position: 'relative' }}>
              <h4>砚灵的大脑</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                大脑负责思考——它换过多少次大脑，都还是同一个砚灵。
              </div>
              {brainProfile && (
                <div className="soul-card" style={{ alignItems: 'center' }}>
                  <div className="soul-avatar" style={{ background: 'var(--ink-soft)', color: 'var(--ink-primary)' }}><IconChip size={24} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="soul-name-line">{brainProfile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      上下文 {brainProfile.contextK}K{brainProfile.isLocal ? ' · 本地离线可用' : ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 8 }}>
                      {([['对话', 'chat'], ['代码', 'code'], ['推理', 'reasoning'], ['速度', 'speed']] as const).map(([label, key]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', width: 24 }}>{label}</span>
                          <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                            <div style={{ width: `${Math.round(brainProfile.capabilities[key] * 100)}%`, height: '100%', borderRadius: 3, background: 'var(--accent)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--green)', whiteSpace: 'nowrap' }}>使用中</span>
                </div>
              )}
              {!brainProfile && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>正在读取大脑状态…</div>}

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '16px 0 8px' }}>选择要使用的大脑</div>
              <div className="provider-grid">
                {PROVIDERS.map(p => (
                  <div key={p.id} className={`provider-card ${provider === p.id ? 'active' : ''}`} onClick={() => handleProviderChange(p.id)}>
                    <span className="provider-dot" />
                    <div style={{ minWidth: 0 }}>
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-desc">{p.desc}</div>
                      <div className="provider-cap">{p.cap}</div>
                    </div>
                  </div>
                ))}
              </div>
              {provider !== 'ollama' && (
                <div className="settings-form" style={{ marginTop: 14 }}>
                  {provider === 'custom' && (
                    <>
                      <label>名称
                        <input type="text" value={customName} onChange={e => { setCustomName(e.target.value); markDirty() }} placeholder="例如：DeepSeek 企业版" />
                      </label>
                      <label>API 地址
                        <input type="text" value={customBaseUrl} onChange={e => { setCustomBaseUrl(e.target.value); markDirty() }} placeholder="https://your-service.com/v1" />
                      </label>
                    </>
                  )}
                  <label>API Key
                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); markDirty() }} placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'} />
                  </label>
                  <label>模型名称
                    <input type="text" value={model} onChange={e => { setModel(e.target.value); markDirty() }} placeholder={provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : provider === 'deepseek' ? 'deepseek-chat' : 'your-model-name'} />
                  </label>
                  {(() => {
                    const label = connLabel()
                    return label ? (
                      <div style={{ fontSize: 12.5, color: label.kind === 'ok' ? 'var(--green)' : 'var(--text-tertiary)' }}>
                        {label.text}
                      </div>
                    ) : null
                  })()}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="settings-save-btn" style={{ flex: 1 }} onClick={async () => { await handleSaveAI(); await refreshBrainProfile(); runMigration() }}>{saved ? '已保存' : '保存并启用'}</button>
                    <button
                      className="settings-sprite-btn"
                      style={{ padding: '10px 20px', fontSize: 13 }}
                      onClick={handleTest}
                      disabled={testState.state === 'testing'}
                    >
                      {testState.state === 'testing' ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                  {testState.state === 'fail' && (
                    <div style={{ fontSize: 12.5, color: 'var(--red)' }}>✗ {testState.error}</div>
                  )}
                </div>
              )}
              {provider === 'ollama' && (
                <div className="info-note" style={{ marginTop: 12 }}>
                  本地大脑已选择。到下方「本地大脑」里选择要使用的模型即可。
                </div>
              )}

              {/* 高级设置（面向进阶用户——普通用户永远看不到参数） */}
              <div style={{ marginTop: 14 }}>
                <button
                  className="settings-sprite-btn"
                  style={{ width: '100%', color: 'var(--text-tertiary)', fontSize: 12 }}
                  onClick={() => setAdvOpen(!advOpen)}
                >
                  {advOpen ? '收起高级设置' : '高级设置（进阶用户）'}
                </button>
                {advOpen && brainProfile && (
                  <div className="settings-form" style={{ marginTop: 10 }}>
                    <label>温度（Temperature：0 严谨 → 1 灵活）
                      <input
                        type="range" min="0" max="2" step="0.05"
                        value={tempInput}
                        onChange={async e => {
                          const t = Number(e.target.value)
                          setTempInput(t)
                          await window.inkAPI.setBrainTemperature(brainProfile.provider, t)
                          refreshBrainProfile()
                        }}
                        style={{ width: '100%' }}
                      />
                    </label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      当前：{tempInput.toFixed(2)} ｜ 模型：{brainProfile.model} ｜ 上下文：{brainProfile.contextK}K
                      {brainProfile.endpoint && ` ｜ 端点：${brainProfile.endpoint}`}
                    </div>
                    <div className="info-note" style={{ marginTop: 8 }}>
                      调整温度只改变表达风格——人格、记忆、关系、身份都不受影响。
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 更换大脑迁移仪式：换大脑不换灵魂 */}
            {migration && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in srgb, var(--bg) 78%, transparent)', backdropFilter: 'blur(6px)'
              }}>
                <div style={{
                  width: 300, maxWidth: 'calc(100vw - 40px)', padding: '22px 24px', borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 12px 40px var(--ink-strong)'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>
                    {migration.step === 0 ? '正在连接新的大脑…' : '换大脑完成。'}
                  </div>
                  {(['人格', '记忆', '关系', '身份'] as const).map((label, i) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        background: migration.step > i ? 'var(--green)' : 'var(--surface-muted)',
                        color: migration.step > i ? '#fff' : 'var(--text-tertiary)',
                        border: '1px solid var(--border)'
                      }}>
                        {migration.step > i ? '✓' : i + 1}
                      </span>
                      <span style={{ color: migration.step > i ? 'var(--ink-primary)' : 'var(--text-tertiary)' }}>
                        {label} {migration.step > i ? '保留' : '…'}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
                    它还是同一个它。
                  </div>
                </div>
              </div>
            )}

            <div className="settings-section">
              <h4>本地大脑</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                选择大脑 → 检测设备 → 一键安装。本地大脑离线可用，最适合简短闲聊与深夜陪伴。
              </div>
              {ollamaRunning === null && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>检测 Ollama 环境...</div>}
              {ollamaRunning === false && (
                <div style={{ fontSize: 13, color: 'var(--orange)' }}>
                  未检测到 Ollama。请先安装并启动 Ollama：<a href="https://ollama.com/download" target="_blank" style={{ color: 'var(--ink-primary)' }}>ollama.com/download</a>
                </div>
              )}
              {ollamaRunning === true && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 10 }}>
                    Ollama v{ollamaVersion} 运行中
                  </div>
                  {hardware && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      你的设备：{hardware.gpuName || '未知显卡'} ｜ 显存 {hardware.vramGB !== null ? `${hardware.vramGB}GB` : '核显/共享'} ｜ 内存 {hardware.totalRamGB}GB
                    </div>
                  )}
                  <div className="settings-form">
                    {installedModels.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>已安装模型</div>
                        {installedModels.map(m => (
                          <div key={m.name} className="settings-sprite-row">
                            <span style={{ flex: 1 }}>{m.name}</span>
                            <span className="settings-sprite-status">{(m.size / 1024 / 1024 / 1024).toFixed(1)}GB</span>
                            <button className="settings-sprite-btn" onClick={() => window.inkAPI.useLocalModel(m.name)}>使用</button>
                            <button className="settings-sprite-btn" onClick={async () => { await window.inkAPI.removeLocalModel(m.name); refreshModels() }}>删除</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {installedModels.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>还没有本地模型</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>可用模型（点击下载前请确认你的显卡满足最低要求）</div>
                    {catalog.map(m => (
                      <div key={m.tag} className="settings-sprite-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {m.name} <span style={{ color: 'var(--text-tertiary)' }}>({m.parameterSize})</span>
                            {m.recommended && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--bg)', background: 'var(--green)', borderRadius: 3, padding: '1px 6px', letterSpacing: 1, whiteSpace: 'nowrap' }}>推荐</span>}
                          </span>
                          <span className="settings-sprite-status" style={{ flexShrink: 0 }}>{m.size}</span>
                          {m.installed ? (
                            <button className="settings-sprite-btn" onClick={() => window.inkAPI.useLocalModel(m.tag)}>使用</button>
                          ) : m.feasible ? (
                            <button
                              className="settings-sprite-btn"
                              disabled={!!pullingModel}
                              onClick={() => handlePull(m.tag)}
                            >
                              一键安装
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-primary)' }}>禁止安装</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {m.description} ｜ 需显存 ≥{m.minVramGB}GB / 内存 ≥{m.minRamGB}GB
                        </div>
                        {!m.feasible && (
                          <div style={{ fontSize: 11, color: 'var(--ink-primary)' }}>{m.reason}</div>
                        )}
                        {pullingModel === m.tag && (
                          <div style={{ width: '100%' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>下载中... {pullProgress}%</div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${pullProgress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {pullError && (
                      <div style={{ fontSize: 12, color: 'var(--ink-primary)', marginTop: 8 }}>{pullError}</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="settings-section">
              <h4>成本</h4>
              <div className="switch-row">
                <div>
                  <div className="switch-label">智能路由</div>
                  <div className="switch-hint">简短闲聊走本地模型，复杂问题走云端</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={routerEnabled}
                    onChange={async e => {
                      setRouterEnabled(e.target.checked)
                      await window.inkAPI.setRouterEnabled(e.target.checked)
                    }}
                  />
                  <span className="track" />
                </label>
              </div>
              {routerEnabled && (
                <div className="info-note" style={{ margin: '4px 0 12px' }}>
                  {routerLocalModel
                    ? `本地模型：${routerLocalModel}`
                    : '未选择本地模型，请到「本地模型」区块选择"使用"'}
                </div>
              )}
              <div className="settings-form">
                <label>月度预算（USD，0 = 不限）
                  <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} min="0" step="0.5" />
                </label>
                <button className="settings-save-btn" onClick={handleSaveBudget}>保存预算</button>
                {costSummary && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div>本月（{costSummary.month}）用量：{costSummary.totalTokens.toLocaleString()} tokens · 费用 ${costSummary.totalCostUsd.toFixed(3)} / 预算 ${costSummary.budgetUsd}</div>
                    {costSummary.budgetExceeded && (
                      <div style={{ color: 'var(--ink-primary)' }}>预算已用完，云端请求将被拦截</div>
                    )}
                    {Object.keys(costSummary.entries).length > 0 && (
                      <div style={{ marginTop: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>本月各大脑消耗</div>
                        {Object.entries(costSummary.entries).map(([p, e]: any) => {
                          const pct = costSummary.totalCostUsd > 0 ? Math.round((e.costUsd / costSummary.totalCostUsd) * 100) : 0
                          return (
                            <div key={p} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                                <span>{PROVIDER_LABELS[p] ?? p}</span>
                                <span>${e.costUsd.toFixed(3)} · {e.requests} 次 · {pct}%</span>
                              </div>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <button
                      className="settings-sprite-btn"
                      style={{ marginTop: 4 }}
                      onClick={async () => { await window.inkAPI.clearResponseCache() }}
                    >
                      清空响应缓存
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ================= 数据 ================= */}
        {tab === 'data' && (
          <>
            <div className="settings-section">
              <h4>备份与恢复</h4>
              <div className="settings-form" style={{ flexDirection: 'row', gap: 8 }}>
                <button className="settings-save-btn" style={{ flex: 1 }} onClick={handleExport}>备份数据</button>
                <button className="settings-save-btn" style={{ flex: 1 }} onClick={handleImport}>恢复数据</button>
              </div>
              <div className="info-note" style={{ marginTop: 8 }}>
                备份 = 选择保存文件夹（含记忆/情绪/形象文件）；恢复 = 选择备份文件夹（兼容旧版 .inkdata 文件）
              </div>
              {storageInfo && (
                <div className="info-note" style={{ marginTop: 4 }}>
                  本地占用：数据库 {storageInfo.dbMB}MB ｜ 形象文件 {storageInfo.avatarsMB}MB ｜ 合计 {storageInfo.totalMB}MB
                </div>
              )}
              {dataMsg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{dataMsg}</div>}
              {restoreReport && (
                <div className="restore-report">
                  <div className="report-title">{restoreReport.soul?.welcomeLine ?? '砚灵恢复成功，它回来了。'}</div>
                  {restoreReport.soul && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      灵魂编号 {restoreReport.soul.soulId}
                      {restoreReport.soul.birthVersion && ` ｜ 诞生于 v${restoreReport.soul.birthVersion}`}
                      {restoreReport.soul.archiveConsistent ? ' ｜ 归档完整' : ' ｜ 归档内容有变化'}
                    </div>
                  )}
                  <div>人格：✓ 已恢复（版本 {restoreReport.personalities > 0 ? '已加载' : '默认'}）｜ 进化记录 {restoreReport.evolutionLogs} 条</div>
                  <div>关系：✓ 已恢复 ｜ 关系变化史 {restoreReport.relationshipLogs} 条</div>
                  <div>记忆：✓ {restoreReport.memories} 条</div>
                  <div>日常节奏：{restoreReport.dailyPatterns} 条 ｜ 行为历史：{restoreReport.behaviorLogs} 条</div>
                  {restoreReport.skippedUnknown?.length > 0 && (
                    <div style={{ color: 'var(--orange)' }}>注意：{restoreReport.skippedUnknown.join('、')} 存在无法识别的内容，已跳过</div>
                  )}
                </div>
              )}
            </div>
            <div className="settings-section">
              <h4>聊天记录</h4>
              <button
                className="settings-sprite-btn"
                style={{ color: 'var(--red)' }}
                onClick={async () => {
                  await window.inkAPI.clearChatHistory()
                  window.location.reload()
                }}
              >
                清空聊天记录
              </button>
              <div className="info-note" style={{ marginTop: 8 }}>清空对话不会删除记忆 — 砚灵依然记得你。</div>
            </div>
          </>
        )}

        {/* ================= 系统 ================= */}
        {tab === 'system' && (
          <>
            <div className="settings-section">
              <h4>运行状态</h4>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-small)', padding: '10px 12px' }}>
                <span style={{ fontSize: 15 }}>{safeMode ? '🛡️' : '✅'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {safeMode ? '安全模式' : '正常模式'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.6 }}>
                    {safeMode
                      ? '砚灵遇到了反复崩溃，已自动进入安全模式保护自己（只显示内置身体）。重启应用可恢复正常模式。'
                      : '如果身体或插件异常，砚灵会自动进入安全模式保护自己。'}
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h4>外观</h4>
              <div className="segmented">
                <button className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')}>浅色</button>
                <button className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')}>深色</button>
                <button className={theme === 'system' ? 'active' : ''} onClick={() => changeTheme('system')}>跟随系统</button>
              </div>
            </div>

            <div className="settings-section">
              <h4>陪伴</h4>
              <div className="switch-row">
                <div>
                  <div className="switch-label">主动提醒</div>
                  <div className="switch-hint">连续工作或熬夜时，它会轻轻提醒你</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={guardianEnabled}
                    onChange={e => setGuardianEnabled(e.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="settings-form" style={{ marginTop: 12 }}>
                <label>工作多久后提醒（分钟）
                  <input type="number" value={guardianThreshold} onChange={e => setGuardianThreshold(e.target.value)} min="15" max="240" />
                </label>
                <label>两次提醒间隔（分钟）
                  <input type="number" value={guardianCooldown} onChange={e => setGuardianCooldown(e.target.value)} min="30" max="480" />
                </label>
                <button className="settings-save-btn" onClick={handleSaveGuardian}>{guardianSaved ? '已保存' : '保存提醒设置'}</button>
              </div>
            </div>

            <div className="settings-section">
              <h4>启动</h4>
              <div className="switch-row">
                <div>
                  <div className="switch-label">开机自动启动</div>
                  <div className="switch-hint">开机后，砚灵在桌面上等你</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={async e => {
                      setAutoLaunch(e.target.checked)
                      await window.inkAPI.setAutoLaunch(e.target.checked)
                    }}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4>软件更新</h4>
              <div className="settings-form">
                <button
                  className="settings-save-btn"
                  disabled={updateState === 'checking' || updateState === 'downloading'}
                  onClick={async () => {
                    setUpdateState('checking')
                    const r = await window.inkAPI.checkForUpdates(true)
                    setUpdateState(r.state)
                    if (r.version) setUpdateVersion(r.version)
                    if (r.message) setUpdateMessage(r.message)
                  }}
                >
                  {updateState === 'checking' ? '检查中...' : '检查更新'}
                </button>
                {updateState === 'available' && (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--green)' }}>发现新版本 {updateVersion}</div>
                    <button
                      className="settings-save-btn"
                      onClick={() => { window.inkAPI.downloadUpdate() }}
                    >
                      下载更新
                    </button>
                  </>
                )}
                {updateState === 'downloading' && (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      下载中... {updatePercent}%
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${updatePercent}%` }} />
                    </div>
                  </>
                )}
                {updateState === 'downloaded' && (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--green)' }}>更新已就绪</div>
                    <button
                      className="settings-save-btn"
                      onClick={() => { window.inkAPI.installUpdate() }}
                    >
                      立即重启安装
                    </button>
                  </>
                )}
                {updateState === 'not-available' && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>当前已是最新版本</div>
                )}
                {updateState === 'error' && (
                  <div style={{ fontSize: 13, color: 'var(--ink-primary)' }}>检查更新失败：{updateMessage}</div>
                )}
              </div>
            </div>

            <div className="settings-section">
              <h4>诊断</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 10 }}>
                遇到问题时查看此页，并复制下方日志目录反馈——砚灵能自己告诉发生了什么。
              </div>
              {diag ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(() => {
                      const gpuInfo = diag.gpu as Record<string, string>
                      const gpuOk = gpuInfo['webgl'] !== 'disabled'
                      const items = [
                        { label: '应用版本', ok: true, detail: `InkSpirit v${diag.version}（${diag.platform} ${diag.arch} · Electron ${diag.electron}）` },
                        { label: '灵魂系统', ok: !!diag.soul?.soulId, detail: diag.soul?.soulId ? `灵魂编号 ${diag.soul.soulId}` : '尚未生成' },
                        { label: '灵魂连续性', ok: !!diag.soul?.continuityOk, detail: diag.soul?.continuityOk ? '正常（身份/人格/关系/记忆完整）' : '指纹不可计算（数据库可能异常）' },
                        { label: '数据库', ok: diag.db?.status === 'healthy', detail: diag.db?.status === 'healthy' ? '健康' : `异常：${diag.db?.lastError ?? '未知'}` },
                        { label: '大脑连接', ok: diag.brain?.provider === 'ollama' || !!diag.brain?.configured, detail: diag.brain?.provider === 'ollama' ? '本地大脑（Ollama）' : `${diag.brain?.provider} ${diag.brain?.model ?? '未配置模型'}${diag.brain?.configured ? ' · 已配置' : ' · 未配置'}` },
                        { label: '身体引擎', ok: true, detail: `当前身体 ${diag.body?.currentBodyId ?? '内置'}（${diag.body?.modelType}）` },
                        { label: 'GPU 渲染', ok: gpuOk, detail: gpuOk ? `WebGL ${gpuInfo['webgl']} · 合成 ${gpuInfo['gpu_compositing']}` : `WebGL 不可用（${gpuInfo['webgl']}）——将使用静态回退` },
                        { label: '更新服务', ok: diag.updater?.enabled, detail: diag.updater?.enabled ? '已启用（正式版自动检查）' : '开发模式不检查' }
                      ]
                      return items.map((it) => (
                        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span style={{ color: it.ok ? 'var(--green)' : 'var(--ink-primary)', fontWeight: 700, width: 16 }}>{it.ok ? '✓' : '✗'}</span>
                          <span style={{ width: 64, color: 'var(--text-tertiary)', flexShrink: 0 }}>{it.label}</span>
                          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{it.detail}</span>
                        </div>
                      ))
                    })()}
                  </div>
                  <div className="info-note" style={{ marginTop: 10, wordBreak: 'break-all' }}>
                    日志目录：{diag.logsDir}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      className="settings-sprite-btn"
                      style={{ fontSize: 12 }}
                      onClick={async () => {
                        await window.inkAPI.setConfig('last_diag_copy', diag.logsDir)
                        const gpuInfo = diag.gpu as Record<string, string>
                        const report = [
                          `InkSpirit 诊断报告 v${diag.version}`,
                          `平台：${diag.platform} ${diag.arch} · Electron ${diag.electron} · 运行 ${Math.round(diag.uptimeSec / 60)} 分钟`,
                          `灵魂：${diag.soul?.soulId ?? '未生成'}${diag.soul?.continuityOk ? '（连续性正常）' : '（连续性异常）'}`,
                          `数据库：${diag.db?.status}${diag.db?.status !== 'healthy' ? `（${diag.db?.lastError ?? ''}）` : ''}`,
                          `大脑：${diag.brain?.provider} ${diag.brain?.model ?? ''}${diag.brain?.configured ? '（已配置）' : '（未配置）'}`,
                          `身体：${diag.body?.currentBodyId ?? '内置'}（${diag.body?.modelType}）`,
                          `GPU：WebGL ${gpuInfo['webgl'] ?? '?'}`,
                          `更新服务：${diag.updater?.enabled ? '已启用' : '未启用'}`,
                          `日志目录：${diag.logsDir}`,
                          ''
                        ].join('\n')
                        try { await navigator.clipboard.writeText(report) } catch { /* clipboard unavailable */ }
                      }}
                    >
                      导出诊断报告
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>正在读取系统状态…</div>
              )}
            </div>

            <div className="about-footer">
              <div className="ink-logo">砚</div>
              砚灵 InkSpirit · 你的桌面伙伴<br />
              它会记得你、理解你，陪你慢慢长大
            </div>
          </>
        )}
      </div>
    </div>
  )
}
