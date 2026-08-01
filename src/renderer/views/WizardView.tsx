import { useState, useCallback } from 'react'

type WizardStep = 'welcome' | 'choose_type' | 'import_sprites' | 'import_live2d' | 'ai_config' | 'done'

interface WizardViewProps { onComplete: () => void }

export function WizardView({ onComplete }: WizardViewProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [idleSprite, setIdleSprite] = useState<string | null>(null)
  const [walkSprite, setWalkSprite] = useState<string | null>(null)
  const [sleepSprite, setSleepSprite] = useState<string | null>(null)
  const [live2dPath, setLive2dPath] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [importing, setImporting] = useState(false)

  const handleImportIdle = useCallback(async () => {
    setImporting(true)
    const r = await window.inkAPI.importModel('idle')
    setImporting(false)
    if (r.success && r.path) setIdleSprite(r.path)
  }, [])

  const handleImportWalk = useCallback(async () => {
    setImporting(true)
    const r = await window.inkAPI.importModel('walk')
    setImporting(false)
    if (r.success && r.path) setWalkSprite(r.path)
  }, [])

  const handleImportSleep = useCallback(async () => {
    setImporting(true)
    const r = await window.inkAPI.importModel('sleep')
    setImporting(false)
    if (r.success && r.path) setSleepSprite(r.path)
  }, [])

  const handleImportLive2D = useCallback(async () => {
    setImporting(true)
    const r = await window.inkAPI.importLive2DModel()
    setImporting(false)
    if (r.success && r.path) setLive2dPath(r.path)
  }, [])

  const handleSaveAI = useCallback(async () => {
    if (apiKey.trim()) await window.inkAPI.configureProvider('openai', apiKey.trim(), 'gpt-4o-mini')
    await window.inkAPI.setConfig('first_launch', 'false')
    setStep('done')
  }, [apiKey])

  const canProceed = idleSprite || live2dPath

  return (
    <div className="wizard-container">
      {step === 'welcome' && (
        <div className="wizard-step">
          <div className="wizard-icon">&#x1f9d9;</div>
          <h2>欢迎来到 InkSpirit</h2>
          <p className="wizard-desc">创造属于你的专属桌面伙伴</p>
          <div className="wizard-actions">
            <button className="wizard-btn primary" onClick={() => setStep('choose_type')}>开始</button>
          </div>
        </div>
      )}

      {step === 'choose_type' && (
        <div className="wizard-step">
          <h2>选择模型类型</h2>
          <p className="wizard-desc">你想用哪种方式展现伙伴？</p>
          <div className="wizard-actions" style={{ flexDirection: 'column', gap: 12 }}>
            <button className="wizard-btn" style={{ padding: '24px', width: '100%' }} onClick={() => setStep('import_live2d')}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1f3ac;</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Live2D 模型</div>
              <p className="wizard-sub" style={{ marginBottom: 0, marginTop: 4 }}>导入 .model3.json 模型文件夹</p>
            </button>
            <button className="wizard-btn" style={{ padding: '24px', width: '100%' }} onClick={() => setStep('import_sprites')}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1f5bc;</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>精灵图</div>
              <p className="wizard-sub" style={{ marginBottom: 0, marginTop: 4 }}>导入 PNG / GIF 图片作为形象</p>
            </button>
          </div>
        </div>
      )}

      {step === 'import_live2d' && (
        <div className="wizard-step">
          <h3>导入 Live2D 模型</h3>
          <p className="wizard-desc">选择模型文件夹中的 .model3.json 文件</p>
          <p className="wizard-sub">会自动复制整个模型文件夹</p>
          <div className={`wizard-dropzone ${live2dPath ? 'has-file' : ''}`} onClick={handleImportLive2D} style={{ height: 140 }}>
            {importing ? <span>导入中...</span> : live2dPath ? <span style={{ color: 'var(--moss)' }}>模型已导入</span> : <><span className="wizard-dropzone-icon">+</span><span>点击选择 .model3.json</span></>}
          </div>
          <div className="wizard-actions">
            <button className="wizard-btn" onClick={() => setStep('choose_type')}>上一步</button>
            <button className="wizard-btn primary" disabled={!live2dPath} onClick={() => setStep('ai_config')}>下一步</button>
          </div>
        </div>
      )}

      {step === 'import_sprites' && (
        <div className="wizard-step">
          <h3>选择形象</h3>
          <div className="wizard-import-section"><h3>默认形象（必需）</h3>
            <div className={`wizard-dropzone ${idleSprite ? 'has-file' : ''}`} onClick={handleImportIdle}>
              {importing ? <span>导入中...</span> : idleSprite ? <img src={idleSprite} alt="idle" className="wizard-preview" /> : <><span className="wizard-dropzone-icon">+</span><span>点击选择 PNG / GIF</span></>}
            </div>
          </div>
          <div className="wizard-import-section"><h3>行走（可选）</h3>
            <div className={`wizard-dropzone small ${walkSprite ? 'has-file' : ''}`} onClick={handleImportWalk}>
              {walkSprite ? <img src={walkSprite} alt="walk" className="wizard-preview" /> : <span>+</span>}
            </div>
          </div>
          <div className="wizard-import-section"><h3>睡觉（可选）</h3>
            <div className={`wizard-dropzone small ${sleepSprite ? 'has-file' : ''}`} onClick={handleImportSleep}>
              {sleepSprite ? <img src={sleepSprite} alt="sleep" className="wizard-preview" /> : <span>+</span>}
            </div>
          </div>
          <div className="wizard-actions">
            <button className="wizard-btn" onClick={() => setStep('choose_type')}>上一步</button>
            <button className="wizard-btn primary" disabled={!idleSprite} onClick={() => setStep('ai_config')}>下一步</button>
          </div>
        </div>
      )}

      {step === 'ai_config' && (
        <div className="wizard-step">
          <h3>配置 AI 大脑</h3>
          <p className="wizard-desc">让你的伙伴拥有思考和对话的能力</p>
          <p className="wizard-sub">可跳过，稍后在设置中配置</p>
          <div className="wizard-form"><label>OpenAI API Key<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." autoFocus /></label></div>
          <div className="wizard-actions">
            <button className="wizard-btn" onClick={() => setStep(live2dPath ? 'import_live2d' : 'import_sprites')}>上一步</button>
            <button className="wizard-btn primary" onClick={handleSaveAI}>保存并完成</button>
          </div>
          <button className="wizard-skip" onClick={() => { window.inkAPI.setConfig('first_launch', 'false'); onComplete() }}>跳过，稍后配置</button>
        </div>
      )}

      {step === 'done' && (
        <div className="wizard-step">
          <div className="wizard-icon">&#x2728;</div>
          <h2>伙伴已就绪</h2>
          <p className="wizard-desc">它会一直在桌面上陪伴你</p>
          <button className="wizard-btn primary" onClick={onComplete}>进入桌面</button>
        </div>
      )}
    </div>
  )
}
