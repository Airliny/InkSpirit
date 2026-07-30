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

  useEffect(() => {
    window.inkAPI.getConfig('provider').then(v => { if (v) setProvider(v) })
    window.inkAPI.getConfig('openai_api_key').then(v => { if (v) setApiKey(v) })
    window.inkAPI.getConfig('openai_model').then(v => { if (v) setModel(v) })
  }, [])

  async function handleSaveAI() {
    await window.inkAPI.configureProvider(provider, apiKey, model || undefined)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
