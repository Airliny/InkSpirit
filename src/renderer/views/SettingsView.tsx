import { useState, useEffect } from 'react'
import type { ModelSource, SpriteSource } from '../components/avatar/modelTypes'
import { loadThemePreference, saveThemePreference, type ThemePreference } from '../design/theme'

interface SettingsViewProps {
  modelSource: ModelSource
  onModelSourceChange: (source: ModelSource) => void
  onBack: () => void
  onBackToPet: () => void
}

type SettingsTab = 'soul' | 'brain' | 'data' | 'system'

const TABS: { id: SettingsTab; icon: string; label: string }[] = [
  { id: 'soul', icon: '🐾', label: '我的砚灵' },
  { id: 'brain', icon: '🧠', label: 'AI大脑' },
  { id: 'data', icon: '💾', label: '数据' },
  { id: 'system', icon: '⚙️', label: '系统' }
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

export function SettingsView({ modelSource, onModelSourceChange, onBack, onBackToPet }: SettingsViewProps) {
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
      await window.inkAPI.setConfig('model_type', 'sprites')
      const updated = await window.inkAPI.getModelSprites()
      const sprites: SpriteSource = {}
      for (const [k, v] of Object.entries(updated)) { if (v) (sprites as any)[k] = v }
      onModelSourceChange({ type: 'sprites', sprites })
    }
  }

  async function handleImportLive2D() {
    setImporting(true)
    const r = await window.inkAPI.importLive2DModel()
    setImporting(false)
    if (r.success && r.path) {
      onModelSourceChange({ type: 'live2d', live2d: { type: 'live2d', modelPath: r.path } })
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
          <span className="nav-icon">💬</span>
          回到聊天
        </button>
      </div>

      <div className="settings-content">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3>{TABS.find(t => t.id === tab)?.label}</h3>
            {tab === 'brain' && <div className="settings-subtitle">砚灵的大脑 — 云端与本地模型都在这里</div>}
            {tab === 'soul' && <div className="settings-subtitle">砚灵是你认识的它</div>}
            {tab === 'data' && <div className="settings-subtitle">它的一切记忆都在这里</div>}
            {tab === 'system' && <div className="settings-subtitle">外观与陪伴方式</div>}
          </div>
          <div className="companion-actions" style={{ paddingTop: 4 }}>
            <button className="title-btn" onClick={onBackToPet} title="回到桌面">&#8722;</button>
          </div>
        </div>

        {/* ================= 我的砚灵 ================= */}
        {tab === 'soul' && (
          <>
            <div className="settings-section">
              <h4>它现在的样子</h4>
              <div className="soul-card">
                <div className="soul-avatar">{soulName.slice(0, 1)}</div>
                <div className="soul-lines">
                  <div className="soul-name-line">{soulName}</div>
                  <div className="soul-meta-line">
                    {days ? `你们认识 ${days} 天` : '你们刚刚相遇'} · {stageLabel(soulState?.relationshipStage ?? 'stranger')}
                    {soulState?.memories && ` · 记得 ${soulState.memories.longTerm} 件重要的事`}
                  </div>
                  <div className="soul-feel-line">最近：<span className={feel.cls}>{feel.text}</span></div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 10 }}>
                名字不是标签 — 通过对话告诉它，它就会一直用这个名字称呼你。
              </div>
            </div>

            <div className="settings-section">
              <h4>性格</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{personalitySummary()}</div>
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
              <h4>外观</h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-small)', padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>两种形象模式的能力差异</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--ink-primary)', fontWeight: 600, marginBottom: 2 }}>Live2D 模型</div>
                    <div style={{ color: 'var(--text-tertiary)' }}>
                      只需一个模型文件<br />
                      自带呼吸/眨眼等动画<br />
                      情绪切换动作需模型自带对应动作<br />
                      部分模型可能不响应情绪切换
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 2 }}>精灵图</div>
                    <div style={{ color: 'var(--text-tertiary)' }}>
                      可逐动作导入 10 张图<br />
                      未导入的动作自动用默认图<br />
                      情绪/行为会切换对应图片<br />
                      需要准备多张动作图
                    </div>
                  </div>
                </div>
              </div>
              {modelSource.type === 'live2d' && (
                <div style={{ marginBottom: 8 }}>
                  <button
                    className="settings-sprite-btn"
                    onClick={async () => {
                      await window.inkAPI.setConfig('model_type', 'sprites')
                      // Load any previously imported sprites instead of an empty set
                      const updated = await window.inkAPI.getModelSprites()
                      const sprites: SpriteSource = {}
                      for (const [k, v] of Object.entries(updated)) { if (v) (sprites as any)[k] = v }
                      onModelSourceChange({ type: 'sprites', sprites })
                    }}
                    style={{ color: 'var(--ink-primary)' }}
                  >
                    切换为精灵图模式
                  </button>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <button className="settings-sprite-btn" onClick={handleImportLive2D} disabled={importing} style={{ width: '100%', padding: '12px' }}>
                  {importing ? '导入中...' : (modelSource.type === 'live2d' ? 'Live2D 模型已加载 — 点击重新导入' : '导入 Live2D 模型 (.model3.json)')}
                </button>
              </div>
              {modelSource.type === 'sprites' && (
                <div className="settings-sprites">
                  {Object.entries(spriteLabels).map(([key, label]) => (
                    <div key={key} className="settings-sprite-row">
                      <span>{label}</span>
                      <span className={`settings-sprite-status ${(modelSource as any).sprites?.[key] ? 'has' : ''}`}>{(modelSource as any).sprites?.[key] ? '已导入' : '未导入'}</span>
                      <button className="settings-sprite-btn" onClick={() => handleImportSprite(key)} disabled={importing}>导入</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= AI大脑 ================= */}
        {tab === 'brain' && (
          <>
            <div className="settings-section">
              <h4>大脑选择</h4>
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
                    <button className="settings-save-btn" style={{ flex: 1 }} onClick={handleSaveAI}>{saved ? '已保存' : '保存设置'}</button>
                    <button
                      className="settings-sprite-btn"
                      style={{ padding: '10px 20px', fontSize: 13 }}
                      onClick={handleTest}
                      disabled={testState.state === 'testing'}
                    >
                      {testState.state === 'testing' ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                  {testState.state === 'ok' && (
                    <div style={{ fontSize: 12.5, color: 'var(--green)' }}>
                      ✓ 连接成功 · 延迟 {testState.latencyMs}ms
                    </div>
                  )}
                  {testState.state === 'fail' && (
                    <div style={{ fontSize: 12.5, color: 'var(--red)' }}>✗ {testState.error}</div>
                  )}
                </div>
              )}
              {provider === 'ollama' && (
                <div className="info-note" style={{ marginTop: 12 }}>
                  本地大脑已选择。到下方「本地模型」里选择要使用的模型即可。
                </div>
              )}
            </div>

            <div className="settings-section">
              <h4>本地模型</h4>
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
                          <span style={{ flex: 1, fontWeight: 500 }}>
                            {m.name} <span style={{ color: 'var(--text-tertiary)' }}>({m.parameterSize})</span>
                            {m.recommended && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--bg)', background: 'var(--green)', borderRadius: 3, padding: '1px 6px', letterSpacing: 1 }}>推荐</span>}
                          </span>
                          <span className="settings-sprite-status">{m.size}</span>
                          {m.installed ? (
                            <button className="settings-sprite-btn" onClick={() => window.inkAPI.useLocalModel(m.tag)}>使用</button>
                          ) : m.feasible ? (
                            <button
                              className="settings-sprite-btn"
                              disabled={!!pullingModel}
                              onClick={() => handlePull(m.tag)}
                            >
                              下载
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-primary)' }}>禁止安装</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
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
                  <div className="report-title">砚灵恢复成功，它回来了。</div>
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

            <div className="about-footer">
              <div className="ink-logo">🐱</div>
              砚灵 InkSpirit · 你的桌面伙伴<br />
              它会记得你、理解你，陪你慢慢长大
            </div>
          </>
        )}
      </div>
    </div>
  )
}
