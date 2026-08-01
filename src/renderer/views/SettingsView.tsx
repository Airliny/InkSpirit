import { useState, useEffect } from 'react'
import type { ModelSource, SpriteSource } from '../components/avatar/modelTypes'

interface SettingsViewProps {
  modelSource: ModelSource
  onModelSourceChange: (source: ModelSource) => void
  onBack: () => void
}

export function SettingsView({ modelSource, onModelSourceChange, onBack }: SettingsViewProps) {
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
  const [petName, setPetName] = useState('')
  const [storageInfo, setStorageInfo] = useState<any>(null)

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
    }
    load()

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
    // Load the API key/model belonging to the newly selected provider
    const [key, savedModel] = await Promise.all([
      window.inkAPI.getSecureConfig(`${p}_api_key`),
      window.inkAPI.getConfig(`${p}_model`)
    ])
    setApiKey(key || '')
    setModel(savedModel || '')
  }

  async function handleSaveAI() {
    await window.inkAPI.configureProvider(provider, apiKey, model || undefined)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  function emotionLabel(e: string): string {
    const map: Record<string, string> = {
      neutral: '平静', happy: '开心', excited: '兴奋', calm: '安宁', curious: '好奇',
      focused: '专注', concerned: '担忧', tired: '疲惫', playful: '爱玩', thoughtful: '沉思',
      sad: '难过', lonely: '孤独', upset: '低落', hurt: '受伤', jealous: '吃醋',
      anxious: '不安', disappointed: '失望', shy: '害羞', proud: '得意', ignoring: '闹别扭'
    }
    return map[e] ?? e
  }

  return (
    <div className="settings-view">
      <h3>设置</h3>

      <div className="settings-section">
        <h4>灵魂状态</h4>
        <div className="settings-form" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            人格模式
            {personalityMode === 'auto' && currentMode && (
              <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                当前自动判定：{currentMode === 'professional' ? '专业' : '陪伴'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="settings-save-btn"
              style={{ flex: 1, background: personalityMode === 'auto' ? 'var(--accent)' : 'var(--bg-tertiary)', color: personalityMode === 'auto' ? '#fff' : 'var(--text-primary)' }}
              onClick={async () => {
                setPersonalityMode('auto')
                await window.inkAPI.setConfig('personality_mode', 'auto')
              }}
            >
              自动切换
            </button>
            <button
              className="settings-save-btn"
              style={{ flex: 1, background: personalityMode === 'companion' ? 'var(--accent)' : 'var(--bg-tertiary)', color: personalityMode === 'companion' ? '#fff' : 'var(--text-primary)' }}
              onClick={async () => {
                setPersonalityMode('companion')
                await window.inkAPI.setConfig('personality_mode', 'companion')
              }}
            >
              陪伴
            </button>
            <button
              className="settings-save-btn"
              style={{ flex: 1, background: personalityMode === 'professional' ? 'var(--accent)' : 'var(--bg-tertiary)', color: personalityMode === 'professional' ? '#fff' : 'var(--text-primary)' }}
              onClick={async () => {
                setPersonalityMode('professional')
                await window.inkAPI.setConfig('personality_mode', 'professional')
              }}
            >
              专业
            </button>
          </div>
          {personalityMode === 'auto' && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              自动模式：任务型问题（代码/分析/方案）自动切专业，闲聊自动切陪伴；识别不准可手动指定
            </div>
          )}
        </div>
        {soulState ? (
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              名字：<span style={{ fontWeight: 600 }}>{petName || '未命名（跟它说"给你起个名字叫XX"）'}</span>
               ｜ 关系：<span style={{ fontWeight: 600 }}>{stageLabel(soulState.relationshipStage)}</span>
               ｜ 主导情绪：<span style={{ fontWeight: 600 }}>{emotionLabel(soulState.emotion?.dominantEmotion)}</span>
            </div>
            {soulState.memories && (
              <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                记得 {soulState.memories.longTerm} 件重要的事，{soulState.memories.shortTerm} 件最近的事
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {personalityLabels.map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ width: 52, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--separator)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((soulState.personality?.[key] ?? 0) * 100)}%`, background: 'var(--text-primary)', borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 26, textAlign: 'right', color: 'var(--text-tertiary)' }}>{Math.round((soulState.personality?.[key] ?? 0) * 100)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>加载中...</div>
        )}
      </div>

      <div className="settings-section">
        <h4>AI 配置</h4>
        <div className="settings-form">
          <label>Provider
            <select value={provider} onChange={e => handleProviderChange(e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="ollama">Ollama (本地)</option>
            </select>
          </label>
          {provider !== 'ollama' && (
            <label>API Key
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'} />
            </label>
          )}
          <label>Model
            <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder={provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : provider === 'deepseek' ? 'deepseek-chat' : 'llama3'} />
          </label>
          <button className="settings-save-btn" onClick={handleSaveAI}>{saved ? '已保存' : '保存设置'}</button>
        </div>
      </div>


      <div className="settings-section">
        <h4>伙伴形象</h4>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>两种形象模式的能力差异</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>Live2D 模型</div>
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
              style={{ color: 'var(--accent)' }}
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


      <div className="settings-section">
        <h4>本地模型 (Ollama)</h4>
        {ollamaRunning === null && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>检测 Ollama 环境...</div>}
        {ollamaRunning === false && (
          <div style={{ fontSize: 13, color: 'var(--orange)' }}>
            未检测到 Ollama。请先安装并启动 Ollama：<a href="https://ollama.com/download" target="_blank" style={{ color: 'var(--accent)' }}>ollama.com/download</a>
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
                      <span style={{ fontSize: 11, color: 'var(--accent)' }}>禁止安装</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {m.description} ｜ 需显存 ≥{m.minVramGB}GB / 内存 ≥{m.minRamGB}GB
                  </div>
                  {!m.feasible && (
                    <div style={{ fontSize: 11, color: 'var(--accent)' }}>{m.reason}</div>
                  )}
                  {pullingModel === m.tag && (
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>下载中... {pullProgress}%</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pullProgress}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {pullError && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>{pullError}</div>
              )}
            </div>
          </>
        )}
      </div>


      <div className="settings-section">
        <h4>陪伴提醒</h4>
        <div className="settings-form">
          <label style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>开机自动启动</span>
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={async e => {
                setAutoLaunch(e.target.checked)
                await window.inkAPI.setAutoLaunch(e.target.checked)
              }}
              style={{ width: 18, height: 18 }}
            />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>主动提醒</span>
            <input
              type="checkbox"
              checked={guardianEnabled}
              onChange={e => setGuardianEnabled(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
          </label>
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
        <h4>成本控制</h4>
        <div className="settings-form">
          <label style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>智能路由（简单对话走本地模型）</span>
            <input
              type="checkbox"
              checked={routerEnabled}
              onChange={async e => {
                setRouterEnabled(e.target.checked)
                await window.inkAPI.setRouterEnabled(e.target.checked)
              }}
              style={{ width: 18, height: 18 }}
            />
          </label>
          {routerEnabled && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {routerLocalModel
                ? `本地模型：${routerLocalModel}（简短闲聊自动走本地，复杂问题走云端）`
                : '未选择本地模型，请到"本地模型"区块选择"使用"'}
            </div>
          )}
          <label>月度预算（USD，0 = 不限）
            <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} min="0" step="0.5" />
          </label>
          <button className="settings-save-btn" onClick={handleSaveBudget}>保存预算</button>
          {costSummary && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>本月（{costSummary.month}）用量：{costSummary.totalTokens.toLocaleString()} tokens</div>
              <div>费用：${costSummary.totalCostUsd.toFixed(3)} / 预算 ${costSummary.budgetUsd}</div>
              {costSummary.budgetExceeded && (
                <div style={{ color: 'var(--accent)' }}>预算已用完，云端请求将被拦截</div>
              )}
              {Object.entries(costSummary.entries).map(([p, e]: any) => (
                <div key={p} style={{ color: 'var(--text-tertiary)' }}>
                  {p}: {e.requests} 次 / ${e.costUsd.toFixed(3)}
                </div>
              ))}
              <button
                className="settings-sprite-btn"
                style={{ marginTop: 6 }}
                onClick={async () => { await window.inkAPI.clearResponseCache() }}
              >
                清空响应缓存
              </button>
            </div>
          )}
        </div>
      </div>


      <div className="settings-section">
        <h4>数据管理</h4>
        <div className="settings-form" style={{ flexDirection: 'row', gap: 8 }}>
          <button className="settings-save-btn" style={{ flex: 1 }} onClick={handleExport}>备份数据</button>
          <button className="settings-save-btn" style={{ flex: 1 }} onClick={handleImport}>恢复数据</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
          备份 = 选择保存文件夹（含记忆/情绪/形象文件）；恢复 = 选择备份文件夹（兼容旧版 .inkdata 文件）
        </div>
        {storageInfo && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            本地占用：数据库 {storageInfo.dbMB}MB ｜ 形象文件 {storageInfo.avatarsMB}MB ｜ 合计 {storageInfo.totalMB}MB
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <button
            className="settings-sprite-btn"
            style={{ color: 'var(--accent)' }}
            onClick={async () => {
              await window.inkAPI.clearChatHistory()
              window.location.reload()
            }}
          >
            清空聊天记录
          </button>
        </div>
        {dataMsg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{dataMsg}</div>}
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
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${updatePercent}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
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
            <div style={{ fontSize: 13, color: 'var(--accent)' }}>检查更新失败：{updateMessage}</div>
          )}
        </div>
      </div>


      <button className="settings-back-btn" onClick={onBack}>返回</button>
    </div>
  )
}
