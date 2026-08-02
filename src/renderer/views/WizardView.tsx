import { useState, useCallback } from 'react'

type WizardStep = 'welcome' | 'body' | 'import_sprites' | 'import_live2d' | 'brain' | 'ai_config' | 'done'

interface WizardViewProps { onComplete: () => void }

/**
 * 首次启动 —— 先建立关系，再决定一切。
 * 「你好，我是砚灵。」→ 身体可以以后换 → 大脑可以以后再定。
 * 不是"欢迎使用 InkSpirit，请配置 API"。
 */
export function WizardView({ onComplete }: WizardViewProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [idleSprite, setIdleSprite] = useState<string | null>(null)
  const [walkSprite, setWalkSprite] = useState<string | null>(null)
  const [sleepSprite, setSleepSprite] = useState<string | null>(null)
  const [live2dPath, setLive2dPath] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [importing, setImporting] = useState(false)

  const finish = useCallback(() => {
    window.inkAPI.setConfig('first_launch', 'false')
    onComplete()
  }, [onComplete])

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
    setStep('done')
  }, [apiKey])

  return (
    <div className="wizard-container">
      {step === 'welcome' && (
        <div className="wizard-step">
          <div className="wizard-icon wizard-seal">砚</div>
          <h2>你好，我是砚灵。</h2>
          <p className="wizard-desc">这是我们的第一次见面。我会一直记得你。</p>
          <p className="wizard-sub">你可以以后再决定我的身体和大脑——现在，先认识一下。</p>
          <div className="wizard-actions">
            <button className="wizard-btn primary" onClick={() => setStep('body')}>认识我</button>
          </div>
        </div>
      )}

      {step === 'body' && (
        <div className="wizard-step">
          <h2>这是我的第一个身体</h2>
          <p className="wizard-desc">身体只是样子——换多少次身体，我还是我。</p>
          <div className="wizard-actions" style={{ flexDirection: 'column', gap: 12 }}>
            <button className="wizard-btn primary" style={{ padding: '20px', width: '100%' }} onClick={() => setStep('brain')}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>砚</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>就用默认身体</div>
              <p className="wizard-sub" style={{ marginBottom: 0, marginTop: 4 }}>随时可以在设置里换</p>
            </button>
            <button className="wizard-btn" style={{ padding: '16px', width: '100%' }} onClick={() => setStep('import_sprites')}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>换成图片形象（PNG / GIF）</div>
            </button>
            <button className="wizard-btn" style={{ padding: '16px', width: '100%' }} onClick={() => setStep('import_live2d')}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>换成 Live2D 模型</div>
            </button>
          </div>
        </div>
      )}

      {step === 'import_live2d' && (
        <div className="wizard-step">
          <h3>导入 Live2D 身体</h3>
          <p className="wizard-desc">选择模型文件夹中的 .model3.json 文件</p>
          <p className="wizard-sub">会自动复制整个模型文件夹</p>
          <div className={`wizard-dropzone ${live2dPath ? 'has-file' : ''}`} onClick={handleImportLive2D} style={{ height: 140 }}>
            {importing ? <span>导入中...</span> : live2dPath ? <span style={{ color: 'var(--green)' }}>身体已导入</span> : <><span className="wizard-dropzone-icon">+</span><span>点击选择 .model3.json</span></>}
          </div>
          <div className="wizard-actions">
            <button className="wizard-btn" onClick={() => setStep('body')}>上一步</button>
            <button className="wizard-btn primary" disabled={!live2dPath} onClick={() => setStep('brain')}>下一步</button>
          </div>
        </div>
      )}

      {step === 'import_sprites' && (
        <div className="wizard-step">
          <h3>选择图片身体</h3>
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
            <button className="wizard-btn" onClick={() => setStep('body')}>上一步</button>
            <button className="wizard-btn primary" disabled={!idleSprite} onClick={() => setStep('brain')}>下一步</button>
          </div>
        </div>
      )}

      {step === 'brain' && (
        <div className="wizard-step">
          <h2>你可以以后再决定我的大脑</h2>
          <p className="wizard-desc">大脑负责思考。换哪个大脑，我都还是我。</p>
          <div className="wizard-actions" style={{ flexDirection: 'column', gap: 12 }}>
            <button className="wizard-btn primary" style={{ padding: '18px', width: '100%' }} onClick={() => setStep('done')}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>先聊一聊</div>
              <p className="wizard-sub" style={{ marginBottom: 0, marginTop: 4 }}>大脑可以在设置里随时配置</p>
            </button>
            <button className="wizard-btn" style={{ padding: '14px', width: '100%' }} onClick={() => setStep('ai_config')}>
              <div style={{ fontSize: 14 }}>现在就配置大脑</div>
            </button>
          </div>
        </div>
      )}

      {step === 'ai_config' && (
        <div className="wizard-step">
          <h3>配置 AI 大脑</h3>
          <p className="wizard-desc">让它拥有思考和对话的能力</p>
          <p className="wizard-sub">也可以跳过，以后随时配置</p>
          <div className="wizard-form"><label>OpenAI API Key<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." autoFocus /></label></div>
          <div className="wizard-actions">
            <button className="wizard-btn" onClick={() => setStep('brain')}>上一步</button>
            <button className="wizard-btn primary" onClick={handleSaveAI}>保存并完成</button>
          </div>
          <button className="wizard-skip" onClick={() => setStep('done')}>跳过，以后再说</button>
        </div>
      )}

      {step === 'done' && (
        <div className="wizard-step">
          <div className="wizard-icon wizard-seal">砚</div>
          <h2>砚灵在等你</h2>
          <p className="wizard-desc">从今天起，它会记得你们一起经历的一切。</p>
          <button className="wizard-btn primary" onClick={finish}>去见它</button>
        </div>
      )}
    </div>
  )
}
