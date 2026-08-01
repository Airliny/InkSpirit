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

  useEffect(() => {
    window.inkAPI.getConfig('provider').then(v => { if (v) setProvider(v) })
    window.inkAPI.getConfig('openai_api_key').then(v => { if (v) setApiKey(v) })
    window.inkAPI.getConfig('openai_model').then(v => { if (v) setModel(v) })
    window.inkAPI.getConfig('guardian_enabled').then(v => { if (v) setGuardianEnabled(v !== 'false') })
    window.inkAPI.getConfig('guardian_work_threshold_min').then(v => { if (v) setGuardianThreshold(v) })
    window.inkAPI.getConfig('guardian_cooldown_min').then(v => { if (v) setGuardianCooldown(v) })

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

  async function refreshOllama() {
    const s = await window.inkAPI.getOllamaStatus()
    setOllamaRunning(s.running)
    if (s.version) setOllamaVersion(s.version)
    if (s.running) {
      refreshModels()
    }
  }

  async function refreshModels() {
    const [res, hw] = await Promise.all([
      window.inkAPI.searchModelCatalog(),
      window.inkAPI.getModelHardware()
    ])
    setCatalog(res.models)
    setHardware(hw)
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

  async function handleSaveAI() {
    await window.inkAPI.configureProvider(provider, apiKey, model || undefined)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSaveGuardian() {
    await window.inkAPI.setConfig('guardian_enabled', guardianEnabled ? 'true' : 'false')
    await window.inkAPI.setConfig('guardian_work_threshold_min', guardianThreshold)
    await window.inkAPI.setConfig('guardian_cooldown_min', guardianCooldown)
    setGuardianSaved(true)
    setTimeout(() => setGuardianSaved(false), 2000)
  }

  async function handleImportSprite(key: string) {
    setImporting(true)
    const r = await window.inkAPI.importModel(key)
    setImporting(false)
    if (r.success) {
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

  return (
    <div className="settings-view">
      <h3>设置</h3>

      <div className="settings-section">
        <h4>伙伴形象</h4>
        {modelSource.type === 'live2d' && (
          <div style={{ marginBottom: 8 }}>
            <button className="settings-sprite-btn" onClick={() => onModelSourceChange({ type: 'sprites', sprites: {} })} style={{ color: '#fbbf24' }}>
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
        <h4>陪伴提醒</h4>
        <div className="settings-form">
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
        <h4>本地模型 (Ollama)</h4>
        {ollamaRunning === null && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>检测 Ollama 环境...</div>}
        {ollamaRunning === false && (
          <div style={{ fontSize: 13, color: '#fbbf24' }}>
            未检测到 Ollama。请先安装并启动 Ollama：<a href="https://ollama.com/download" target="_blank" style={{ color: '#818cf8' }}>ollama.com/download</a>
          </div>
        )}
        {ollamaRunning === true && (
          <>
            <div style={{ fontSize: 13, color: '#34d399', marginBottom: 10 }}>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>已安装模型</div>
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>可用模型（点击下载前请确认你的显卡满足最低要求）</div>
              {catalog.map(m => (
                <div key={m.tag} className="settings-sprite-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      {m.name} <span style={{ color: 'var(--text-muted)' }}>({m.parameterSize})</span>
                      {m.recommended && <span style={{ marginLeft: 6, fontSize: 11, color: '#34d399', border: '1px solid #34d399', borderRadius: 8, padding: '0 6px' }}>推荐</span>}
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
                      <span style={{ fontSize: 11, color: '#ff6b6b' }}>禁止安装</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {m.description} ｜ 需显存 ≥{m.minVramGB}GB / 内存 ≥{m.minRamGB}GB
                  </div>
                  {!m.feasible && (
                    <div style={{ fontSize: 11, color: '#ff6b6b' }}>{m.reason}</div>
                  )}
                  {pullingModel === m.tag && (
                    <div style={{ width: '100%' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>下载中... {pullProgress}%</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pullProgress}%`, background: 'var(--gradient-1)', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {pullError && (
                <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 8 }}>{pullError}</div>
              )}
            </div>
          </>
        )}
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                <div style={{ color: '#ff6b6b' }}>预算已用完，云端请求将被拦截</div>
              )}
              {Object.entries(costSummary.entries).map(([p, e]: any) => (
                <div key={p} style={{ color: 'var(--text-muted)' }}>
                  {p}: {e.requests} 次 / ${e.costUsd.toFixed(3)}
                </div>
              ))}
            </div>
          )}
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
              <div style={{ fontSize: 13, color: '#34d399' }}>发现新版本 {updateVersion}</div>
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
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${updatePercent}%`, background: 'var(--gradient-1)', transition: 'width 0.3s' }} />
              </div>
            </>
          )}
          {updateState === 'downloaded' && (
            <>
              <div style={{ fontSize: 13, color: '#34d399' }}>更新已就绪</div>
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
            <div style={{ fontSize: 13, color: '#ff6b6b' }}>检查更新失败：{updateMessage}</div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h4>AI 配置</h4>
        <div className="settings-form">
          <label>Provider
            <select value={provider} onChange={e => setProvider(e.target.value)}>
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

      <button className="settings-back-btn" onClick={onBack}>返回</button>
    </div>
  )
}
