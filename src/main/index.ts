import { app, BrowserWindow, protocol, net, powerMonitor, screen, dialog } from 'electron'
import { createMainWindow, getMainWindow, setPanelMode } from './windowManager'
import { createTray } from './trayManager'
import { registerIpcHandlers } from './ipc/index'
import { openDatabase, getDatabase, recoverDatabase, closeDatabase, type DatabaseState } from '../core/database'
import { Agent } from '../core/agent'
import { markActive, markIdle, getTotalWorkMinutes, getCurrentStreakMin } from './perception/timeTracker'
import { getForegroundWindow } from './perception/windowScanner'
import { classifyForeground, isDoNotDisturb, type ForegroundScene } from './perception/sceneDetector'
import { hangOnWindow, physicalRectToDip } from './windowManager'
import { pollGuardian, setGuardianDisturbBlocked } from './guardian/guardian'
import { pickIdleAnimation, pickAmbientThought } from '../core/autonomy/bodyLoop'
import { initUpdater } from './updater/updater'
import { getCurrentEmotion, forgiveEmotion, applyEmotionDecay, emotionToExpression, flushEmotion, type EmotionState } from '../core/soul/emotion'
import { getRelationship, recordRelationshipEvent } from '../core/soul/relationship'
import { shouldRewardRecall, recallEvent } from '../core/soul/relationshipEvents'
import { tick, getPetState } from '../core/autonomy/drives'
import { decide, type DirectorInput, type BehaviorAction } from '../core/autonomy/behaviorDirector'
import { createBudget, maxForPersonality, type BudgetState } from '../core/autonomy/behaviorBudget'
import { getBehaviorStyle, getActivePersonality } from '../core/soul/personality'
import { getMemorableMemory, recordMemoryRecall, consolidateMemories, decayMemories } from '../core/soul/memory'
import { feed, refreshPatternContext, getLatestSituation } from '../core/world/sensor'
import { recordActiveMinutes, prunePatternRows } from '../core/world/patternsStore'
import { toDateKey } from '../core/world/patterns'
import { getCurrentMood } from '../core/soul/mood'
import { recordLifeEvent, pruneLifeEvents } from '../core/soul/lifeTimeline'
import { emptyPresenceBudget, spendPresence, dateKeyOf } from '../core/avatar/presenceBudget'
import type { PresenceBudgetState } from '../core/avatar/presenceBudget'
import { pathToFileURL } from 'url'
import { migrateToSecure } from '../core/secureStore'
import { preloadConfig, getConfig, setConfig } from '../core/config'
import { uuidv4 } from '../core/utils'
import { writeStartupLog, writeStartupError } from './startupLog'
import { logTo, logsDirectory } from './logs'
import { decideRendererCrashAction, EMPTY_CRASH_STATE } from '../core/rendererCrashPolicy'
import { enterSafeMode } from './safeMode'
import fs from 'fs'
import path from 'path'

let agent: Agent
let userIdleMs = 0
let totalWorkMin = 0
let lastImpulseWasAt = Date.now()
let currentScene: ForegroundScene = 'work'
let behaviorBudget: BudgetState = createBudget(3)
/** Presence Budget：身体行为的每日稀缺（注视/散步/注意） */
let presenceBudgetState: PresenceBudgetState = emptyPresenceBudget(dateKeyOf(Date.now()))
/** 渲染进程崩溃恢复：第 1 次 reload → 第 2 次 safe mode → 第 3 次修复提示 */
let rendererCrashState = EMPTY_CRASH_STATE
const RENDERER_RELOAD_GUARD_MS = 2 * 60 * 1000
/** 重载完成后要导航的页面（修复对话框「打开诊断页」用） */
let pendingNavigateAfterLoad: string | null = null
/** 渲染进程不响应（unresponsive）计时器 */
let unresponsiveTimer: ReturnType<typeof setTimeout> | null = null
/** startup_success 只记一次（崩溃重载不重复统计） */
let startupSuccessLogged = false
let userReturnedAfterMs = 0
let userReturnedAt = 0
let lastRecallMemory: import('../core/soul/memory').Memory | null = null

// --- Crash safety: never die silently ---

process.on('uncaughtException', (err) => {
  writeStartupLog(`uncaughtException: ${err?.stack || err?.message || err}`)
})
process.on('unhandledRejection', (reason) => {
  writeStartupLog(`unhandledRejection: ${String(reason)}`)
})
// 单实例锁：双击/重复启动 → 聚焦已有窗口，绝不出现两个砚灵
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })
}

/**
 * Recovery Mode: DB is unusable. Native dialog only — no business tables,
 * no personality/memory loading, so it can never deadlock on the DB itself.
 * "宁可降级，也不能退出" — at minimum the user sees a window with an action.
 */
async function handleStartupDbFailure(state: DatabaseState): Promise<void> {
  writeStartupLog(`startup_recovery database corrupted: ${state.lastError}`)
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: '砚灵无法启动',
    message: '砚灵的数据文件损坏，无法正常启动。',
    detail: `错误：${state.lastError}\n\n点击「修复」会先把损坏的数据文件备份到你的电脑上（不会被删除），然后重新初始化并重启。\n\n历史人格、记忆和关系无法从损坏文件中恢复。`,
    buttons: ['修复并重新启动', '退出'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response === 0) {
    const recovered = recoverDatabase()
    if (recovered.status === 'healthy') {
      app.relaunch()
      app.exit(0)
      return
    }
    // Recovered DB still failing — surface the error once more, then quit
    writeStartupLog(`startup_failed recovery failed: ${recovered.lastError}`)
    await dialog.showMessageBox({
      type: 'error',
      title: '修复失败',
      message: '重新初始化数据文件也失败了。',
      detail: `错误：${recovered.lastError}\n\n请检查磁盘权限后重试。`,
      buttons: ['退出'],
      noLink: true
    })
  }
  app.exit(0)
}

// ---- Renderer crash recovery: reload → safe mode → repair dialog ----
// 绝不静默：第 1 次崩溃自动重载；第 2 次进入 safe mode（强制内置砚灵）重载；
// 第 3 次停止自动恢复，弹修复提示（打开诊断页 / 重启 / 退出）。

function reloadRenderer(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  setTimeout(() => {
    if (!win.isDestroyed()) win.webContents.reload()
  }, 800)
}

function escalateRendererCrash(win: BrowserWindow, reason: string): void {
  const { action, nextState } = decideRendererCrashAction(rendererCrashState, Date.now(), RENDERER_RELOAD_GUARD_MS)
  rendererCrashState = nextState

  if (action === 'reload') {
    logTo('renderer', `reloading renderer (1) — ${reason}`)
    writeStartupLog(`renderer crash (${reason}) — reload #1`)
    reloadRenderer(win)
    return
  }
  if (action === 'safe-mode-reload') {
    // Safe mode：让渲染层只渲染内置「砚」，不加载 Live2D/VRM/three.js 重资产。
    // 标志持久在主进程 —— reload 后新渲染进程通过 system:getSafeMode 查询恢复。
    logTo('renderer', `reloading renderer (2) — ${reason}, entering safe mode`)
    writeStartupLog(`renderer crash twice (${reason}) — entering safe mode`)
    enterSafeMode()
    if (!win.isDestroyed()) win.webContents.send('app:safeMode')
    reloadRenderer(win)
    return
  }
  // 第 3 次：停止自动恢复，给出修复路径（绝不静默放弃）
  writeStartupError(`renderer crash loop (${reason}) — showing repair dialog`)
  showRendererRepairDialog(win)
}

async function showRendererRepairDialog(win: BrowserWindow | null): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: '砚灵遇到了反复崩溃',
    message: '砚灵反复崩溃，自动恢复没有成功。',
    detail: `可以打开诊断页查看日志，或者重启应用。\n\n日志目录：${logsDirectory()}`,
    buttons: ['打开诊断页', '重启应用', '退出'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response === 0) {
    // 打开诊断页：切到面板 + 重载成功后导航（重载完再 send，避免丢消息）
    setPanelMode()
    pendingNavigateAfterLoad = 'settings'
    if (win && !win.isDestroyed()) reloadRenderer(win)
    return
  }
  if (response === 1) {
    app.relaunch()
    app.exit(0)
    return
  }
  app.quit()
}

app.whenReady().then(() => {
  console.log(`[InkSpirit] v${app.getVersion()} starting. userData: ${app.getPath('userData')}`)
  protocol.handle('local', (request) => {
    const encoded = request.url.substring('local://'.length)
    const filePath = decodeURIComponent(encoded)
    const fileUrl = pathToFileURL(filePath).href
    return net.fetch(fileUrl)
  })
  // Cubism core runtimes for Live2D, served from bundled resources
  // (proprietary files shipped with the app; missing → Live2D falls back)
  protocol.handle('cubism', (request) => {
    const name = request.url.slice('cubism://'.length).split('/')[0]
    if (!name.endsWith('.js')) return new Response(null, { status: 400 })
    const file = path.join(app.getAppPath(), 'resources', 'cubism', name)
    try {
      return new Response(fs.readFileSync(file), {
        headers: { 'content-type': 'application/javascript; charset=utf-8' }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  // Startup protection: DB failure enters Recovery Mode — never a silent,
  // invisible hanging process
  writeStartupLog('01 app ready')
  const dbState = openDatabase()
  if (dbState.status !== 'healthy') {
    handleStartupDbFailure(dbState)
    return
  }
  writeStartupLog('02 database ok')
  preloadConfig()
  // Migrate legacy plaintext API keys to encrypted storage
  for (const p of ['openai', 'anthropic', 'deepseek']) {
    migrateToSecure(`${p}_api_key`)
  }
  try {
    agent = new Agent()
  } catch (err) {
    // Brain config corrupted (e.g. broken personalities JSON) — recover
    // rather than fail the whole app: clear soul-affecting rows and restart
    logTo('brain', `Agent init failed: ${err instanceof Error ? err.message : err}`)
    writeStartupLog(`startup_recovery agent init failed: ${err instanceof Error ? err.message : err}`)
    try {
      const db = getDatabase()
      db.prepare('DELETE FROM personalities').run()
      db.prepare('DELETE FROM relationships').run()
      db.prepare('DELETE FROM emotion_snapshots').run()
    } catch {
      // fall through to recovery dialog
    }
    const recovered = recoverDatabase()
    if (recovered.status === 'healthy') {
      app.relaunch()
      app.exit(0)
      return
    }
    handleStartupDbFailure(recovered)
    return
  }
  writeStartupLog('03 agent ok')
  cleanupOrphanAvatars()
  // IPC first — the renderer must never win a race against its own API
  registerIpcHandlers(agent)
  writeStartupLog('04 ipc handlers registered')
  const win = createMainWindow()
  writeStartupLog('05 window created')
  win.webContents.on('render-process-gone', (_e, details) => {
    logTo('renderer', `render-process-gone: ${details.reason} (${details.exitCode})`)
    if (details.reason === 'clean-exit') return
    escalateRendererCrash(win, `render-process-gone:${details.reason}`)
  })
  win.webContents.on('unresponsive', () => {
    logTo('renderer', 'unresponsive — 30s window before escalation')
    const t = setTimeout(() => {
      logTo('renderer', 'unresponsive persisted — escalating')
      escalateRendererCrash(win, 'unresponsive')
    }, 30000)
    unresponsiveTimer = t
  })
  win.webContents.on('responsive', () => {
    if (unresponsiveTimer) {
      clearTimeout(unresponsiveTimer)
      unresponsiveTimer = null
    }
  })
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) logTo('renderer', `renderer[${level}]: ${message}`)
  })
  // 主页面加载失败：升级恢复链（重载 1 次 → safe mode → 修复提示），绝不静默。
  // 恢复链进入 repair-dialog 后不再因加载失败重弹对话框（避免坏安装时的对话框风暴）。
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    writeStartupLog(`08 did-fail-load code=${code} desc=${desc} url=${url}`)
    if (isMainFrame && rendererCrashState.count < 2) {
      escalateRendererCrash(win, `did-fail-load:${code}`)
    }
  })
  win.webContents.on('did-finish-load', () => {
    writeStartupLog('07 did-finish-load')
    if (!startupSuccessLogged) {
      startupSuccessLogged = true
      writeStartupLog('startup_success')
    }
    if (pendingNavigateAfterLoad) {
      const page = pendingNavigateAfterLoad
      pendingNavigateAfterLoad = null
      win.webContents.send('navigate', page)
    }
  })
  createTray(win)
  startPerception()
  startSceneWatcher()
  startWorldSensor()
  startPatternRecording()
  startHeartbeat()
  startMoodSync()
  startMemoryMaintenance()
  initUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  flushEmotion()
  closeDatabase()
})

function startPerception(): void {
  // Real activity detection via OS-level idle time (powerMonitor)
  const IDLE_THRESHOLD_MS = 45000
  let wasIdle = true
  let idleStartedAt: number | null = null

  const update = () => {
    const idleSec = powerMonitor.getSystemIdleTime()
    const idleMs = idleSec * 1000
    const isIdle = idleMs >= IDLE_THRESHOLD_MS

    if (isIdle && !wasIdle) {
      wasIdle = true
      idleStartedAt = Date.now()
      markIdle()
      userIdleMs = idleMs
      totalWorkMin = getTotalWorkMinutes()
    } else if (!isIdle) {
      if (wasIdle) {
        wasIdle = false
        markActive()
        // The pet noticed the user coming back — the Behavior Director
        // decides how (and whether) to welcome them
        if (idleStartedAt && Date.now() - idleStartedAt > 60 * 1000) {
          userReturnedAfterMs = Date.now() - idleStartedAt
          userReturnedAt = Date.now()
        }
        idleStartedAt = null
      }
      userIdleMs = 0
      totalWorkMin = getTotalWorkMinutes()
    } else {
      userIdleMs = idleMs
    }
    totalWorkMin = getTotalWorkMinutes()
  }

  update()
  setInterval(update, 10000)
}

// ---- Heartbeat: drive-based, irregular ----
let lastMoodPushAt = 0
function startHeartbeat(): void {
  // Tick every ~8 seconds with some jitter
  const tickRate = 8000 + Math.random() * 4000

  setInterval(() => {
    const elapsed = (Date.now() - lastImpulseWasAt) / 1000
    tick(elapsed, userIdleMs) // drive dynamics only — the director decides action
    lastImpulseWasAt = Date.now()

    // Mood（心境）层：约 5 分钟推一次给身体（Emotion→Mood→Temperament）
    if (Date.now() - lastMoodPushAt > 5 * 60 * 1000) {
      lastMoodPushAt = Date.now()
      const mood = getCurrentMood()
      emit('pet:moodState', { valence: mood.valence, arousal: mood.arousal, label: mood.label })
    }

    const { action, budget: nextBudget } = decide(buildDirectorInput())
    behaviorBudget = nextBudget

    if (action) {
      actOn(action)
    } else {
      // No candidate passed selection: natural idle animation as fallback
      emitIdleBehavior()
    }

    // Forgiveness and emotional decay over time
    if (Math.random() < 0.1) {
      forgiveEmotion(0.003)
      applyEmotionDecay()
    }
  }, tickRate)
}

function buildDirectorInput(): DirectorInput {
  const emotion = getCurrentEmotion()
  const personality = getActivePersonality()
  const traits = personality.traits

  // Keep the budget allowance in sync with the personality
  const maxHourly = maxForPersonality(traits.proactiveness)
  if (behaviorBudget.maxHourlyInteractions !== maxHourly) {
    behaviorBudget = createBudget(maxHourly)
  }

  // "Just returned" signal decays after two minutes
  let returnedAfterMs = userReturnedAfterMs
  if (userReturnedAt && Date.now() - userReturnedAt > 2 * 60 * 1000) {
    returnedAfterMs = 0
  }

  const today = new Date().toDateString()
  const mem = getMemorableMemory()
  const recallable = mem !== null && Date.now() - lastRecollectionAt > RECOLLECT_COOLDOWN_MS
  // Captured for actOn(): the director decides, this tick's memory is the one
  // whose recollection gets rewarded
  lastRecallMemory = mem

  // Stage growth is tracked here and expressed via the director (never spoken directly)
  const currentStage = getRelationship().stage
  if (lastStage !== null && lastStage !== currentStage && pendingStageGrow === null) {
    pendingStageGrow = currentStage
  }
  lastStage = currentStage

  // Guardian 信号：进导演（它只输出意图），同时记入 Life Timeline（每天去重）
  const guardianSignal = pollGuardian()
  if (guardianSignal) {
    recordLifeEvent(
      'rest_reminder',
      '提醒你休息',
      '它主动关心你的身体',
      `rest_reminder_${dateKeyOf(Date.now())}`, 'normal'
    )
  }

  return {
    situation: getLatestSituation(),
    relationship: getRelationship(),
    personality: traits,
    emotion,
    driveImpulse: getPetState().impulse,
    flags: {
      returnedAfterMs,
      greetingDoneToday: getConfig('last_greeting_date') === today,
      nightDoneToday: getConfig('last_night_date') === today,
      recallableMemory: recallable,
      recollectSnippet: mem ? (mem.content.length > 24 ? mem.content.slice(0, 24) + '…' : mem.content) : null,
      canHang: !isDisturbing() && userIdleMs < 90000 && Date.now() - lastHangAt >= HANG_COOLDOWN_MS,
      guardianSignal,
      stageGrowTo: pendingStageGrow
    },
    budget: behaviorBudget
  }
}

/** 关系阶段的人类化标签（Life Timeline 用） */
function stageLabelOf(stage: string): string {
  const map: Record<string, string> = {
    stranger: '陌生人', acquaintance: '相识', friend: '朋友',
    close_friend: '挚友', partner: '伴侣'
  }
  return map[stage] ?? stage
}

/** Single executor for director output: renderer channels + traceable logs */
function actOn(action: BehaviorAction): void {
  if (action.behavior) emit('pet:behavior', { behavior: action.behavior })
  if (action.expression) emit('pet:expression', { expression: action.expression })
  if (action.thought) emit('pet:thought', { thought: action.thought })
  if (action.message) emit('pet:speak', { message: action.message, action: action.kind })

  if (action.id === 'hang_window') {
    maybeHangOnWindow().catch(() => {})
  }

  // Caller-side bookkeeping for once-per-day / cooldown behaviors
  if (action.id === 'morning_greeting') setConfig('last_greeting_date', new Date().toDateString())
  if (action.id === 'good_night') setConfig('last_night_date', new Date().toDateString())
  if (action.id === 'recollect') {
    lastRecollectionAt = Date.now()
    // Memory → relationship feedback: a recall proves we remember, but only
    // if the memory is still relevant is it rewarded
    if (lastRecallMemory && shouldRewardRecall(lastRecallMemory)) {
      recordMemoryRecall(lastRecallMemory.id)
      const ev = recallEvent(lastRecallMemory.id, 'success')
      if (ev) recordRelationshipEvent(ev)
    }
  }
  if (action.id === 'stage_grow') {
    pendingStageGrow = null
    // Life Timeline：关系升级（导演表达过之后才记录）
    const stage = getRelationship().stage
    recordLifeEvent('stage_grow', '关系更进一步', `进入了「${stageLabelOf(stage)}」阶段`, `stage_${stage}`, 'major')
  }
  if (action.id === 'hang_window') lastHangAt = Date.now()

  try {
    const db = getDatabase()
    db.prepare(
      'INSERT INTO behavior_logs (id, behavior_id, triggered_by, outcome, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(
      uuidv4(),
      action.id,
      'director',
      JSON.stringify({
        kind: action.kind,
        urgency: action.urgency,
        reason: action.reason,
        message: action.message ?? null
      }),
      Date.now()
    )
  } catch {
    // logging is best-effort
  }
}

// Single body-loop fallback: pure avatar animations + ambient thoughts.
// Boundary: nothing here is a "decision" — speech and active behavior
// only ever come from the BehaviorDirector.
function emitIdleBehavior(): void {
  const emotion = getCurrentEmotion()
  const style = getBehaviorStyle()

  // Presence Budget：主动散步每天有上限——频繁走动会变成"动画插件"；
  // 用户长期不在时预算收紧（安静是亲密，不是更积极）
  let behavior = pickIdleAnimation(emotion.energy, Math.random())
  if (behavior === 'walk') {
    const spend = spendPresence(presenceBudgetState, 'wander', Date.now(), { userPresent: userIdleMs < 60000 })
    presenceBudgetState = spend.state
    if (!spend.allowed) behavior = 'idle'
  }
  emit('pet:behavior', { behavior })

  // Ambient inner monologue (presence, not intent)
  const thought = pickAmbientThought(style.idleThoughtChance, Math.random())
  if (thought) emit('pet:thought', { thought })
}

// ---- Rest reminder: guardian emits intent, director expresses it ----
// Life Timeline：第一次主动提醒休息（每天去重）
function recordGuardianLifeEvent(signal: ReturnType<typeof pollGuardian>): void {
  if (!signal) return
  recordLifeEvent(
    'rest_reminder',
    '提醒你休息',
    '它第一次主动关心你的身体',
    `rest_reminder_${dateKeyOf(Date.now())}`, 'normal'
  )
}

// ---- Scene awareness: what kind of app the user is in (for don't-disturb) ----

function startSceneWatcher(): void {
  const update = async () => {
    if (userIdleMs > 120000) return // user away — scene doesn't matter
    const win = await getForegroundWindow()
    if (!win) return
    // Skip our own window
    if (/inkspirit|砚灵/i.test(win.title)) return
    // The window rect is in physical pixels; Electron screen coords are DIPs,
    // so convert before comparing (avoids false fullscreen on scaled displays)
    const dip = physicalRectToDip(win)
    const display = screen.getDisplayNearestPoint({ x: dip.x + dip.width / 2, y: dip.y + dip.height / 2 })
    const wa = display.workArea
    const fullscreen = dip.width >= wa.width - 40 && dip.height >= wa.height - 40
    currentScene = fullscreen ? 'game' : classifyForeground(win.title)
    setGuardianDisturbBlocked(isDisturbing())
  }
  update()
  setInterval(update, 90000)
}

function isDisturbing(): boolean {
  return isDoNotDisturb(currentScene)
}

// ---- World Model: synthesize user situation, record daily rhythm ----
// P1 scope: understand only. This loop NEVER triggers behavior — the
// BehaviorDirector (P3) will be the only consumer that turns situations
// into actions.

function startWorldSensor(): void {
  refreshPatternContext()
  const tick = () => {
    feed({
      scene: currentScene,
      idleMs: userIdleMs,
      streakMin: getCurrentStreakMin(),
      hour: new Date().getHours()
    })
    pushWorldToBody()
  }
  tick()
  setInterval(tick, 30000)
}

/**
 * World → Body 桥：把生活环境精简信号推给身体（疲劳/深夜/晚睡/作息偏差）。
 * 身体据此慢下来或精神起来——不是播放动画，是真的在那里生活。
 */
function pushWorldToBody(): void {
  const s = getLatestSituation()
  if (!s) return
  emit('pet:world', {
    fatigue: s.fatigue,
    hourContext: s.hourContext,
    sleepLate: !!s.patterns?.sleepLate,
    busyDeviation: s.patterns?.busyDeviation ?? 0,
    quietDeviation: s.patterns?.quietDeviation ?? 0,
    streakMin: s.streakMin,
    userPresent: userIdleMs < 60000
  })
}

function startPatternRecording(): void {
  let lastPruneDay = ''
  setInterval(() => {
    // One active minute per tick while the user is present
    if (userIdleMs < 60000) {
      recordActiveMinutes(1)
    }
    // Prune old rows once per day
    const today = toDateKey(new Date())
    if (today !== lastPruneDay) {
      lastPruneDay = today
      prunePatternRows(21)
    }
  }, 60000)
}

// ---- Climb onto windows (Shimeji-style) ----
// Executed by the director's hang_window action; re-validates the window here.

let lastHangAt = 0
const HANG_COOLDOWN_MS = 5 * 60 * 1000
let lastRecollectionAt = 0
const RECOLLECT_COOLDOWN_MS = 3 * 60 * 60 * 1000

async function maybeHangOnWindow(): Promise<void> {
  if (userIdleMs > 90000) return
  if (isDisturbing()) return
  if (Date.now() - lastHangAt < HANG_COOLDOWN_MS) return

  const win = await getForegroundWindow()
  if (!win) return
  // Skip tiny windows, fullscreen apps, and ourselves (rect converted to DIPs)
  const dip = physicalRectToDip(win)
  const display = screen.getDisplayNearestPoint({ x: dip.x + dip.width / 2, y: dip.y + dip.height / 2 })
  const wa = display.workArea
  if (dip.width < 300 || dip.height < 250) return
  if (dip.height >= wa.height - 80 || dip.width >= wa.width - 80) return
  if (/inkspirit|砚灵/i.test(win.title)) return

  lastHangAt = Date.now()
  hangOnWindow(win)
  emit('pet:behavior', { behavior: 'sit' })
  const thoughts = ['（爬上窗口边，扒着看了看）', '（挂在你窗口上）', '（从窗口边探出脑袋）']
  emit('pet:thought', { thought: thoughts[Math.floor(Math.random() * thoughts.length)] })
}

function emit(channel: string, data: Record<string, unknown>): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

// ---- Mood sync: push real soul state to the renderer ----
// Presentation only — no speech here. Stage growth is expressed via the
// BehaviorDirector (stage_grow intent), never spoken directly.

let lastStage: import('../core/soul/relationshipEvents').RelationshipStage | null = null
let pendingStageGrow: import('../core/soul/relationshipEvents').RelationshipStage | null = null

function startMoodSync(): void {
  setInterval(() => {
    const emotion = getCurrentEmotion()
    emit('pet:expression', { expression: emotionToExpression(emotion.dominantEmotion) })
    emit('pet:mood', { mood: getMood(emotion) })
  }, 15000)
}

function getMood(emotion: EmotionState): string {
  const hour = new Date().getHours()
  // Late night: the pet naturally quiets down even if not fully drained
  if ((hour >= 22 || hour < 6) && emotion.energy < 0.55) return 'sleepy'
  if (emotion.energy < 0.35) return 'sleepy'
  if (emotion.grudge > 0.6) return 'grumpy'
  if (emotion.happiness < 0.3) return 'sad'
  if (emotion.energy > 0.7 && emotion.happiness > 0.6) return 'playful'
  return 'neutral'
}

// ---- Memory maintenance: promote short-term memories, decay old ones ----

function startMemoryMaintenance(): void {
  let lastRun = 0

  const run = () => {
    if (Date.now() - lastRun < 12 * 60 * 60 * 1000) return
    lastRun = Date.now()
    try {
      const consolidated = consolidateMemories()
      const decayed = decayMemories()
      // Keep the conversations table bounded: retain the 10 most recent
      const db = getDatabase()
      db.prepare(
        `DELETE FROM conversations WHERE id NOT IN (
           SELECT id FROM conversations ORDER BY created_at DESC LIMIT 10
         )`
      ).run()
      // Keep behavior logs bounded: retain the most recent 500 entries
      db.prepare(
        `DELETE FROM behavior_logs WHERE id NOT IN (
           SELECT id FROM behavior_logs ORDER BY timestamp DESC LIMIT 500
          )`
      ).run()
      // Life Timeline 分级清理：major 永久保留，normal 保留最近 200 条/365 天
      pruneLifeEvents()
      if (consolidated > 0 || decayed > 0) {
        db.prepare(
          'INSERT INTO behavior_logs (id, behavior_id, triggered_by, outcome, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), 'memory', 'system', JSON.stringify({ consolidated, decayed }), Date.now())
      }
    } catch {
      // maintenance is best-effort
    }
  }

  // Run once at startup so existing short-term memories get promoted
  lastRun = Date.now() - 12 * 60 * 60 * 1000
  run()
  setInterval(run, 60 * 60 * 1000)
}


// ---- Storage hygiene: remove avatar files no longer referenced by config ----

function cleanupOrphanAvatars(): void {
  try {
    const avatarsDir = path.join(app.getPath('userData'), 'avatars')
    if (!fs.existsSync(avatarsDir)) return

    const referencedFiles = new Set<string>()
    const referencedDirs = new Set<string>()

    // Sprites: both current local:// and legacy file:// references
    const spriteKeys = ['idle', 'walk', 'sleep', 'sit', 'stretch', 'yawn', 'surprised', 'happy', 'sad', 'love']
    for (const k of spriteKeys) {
      const v = getConfig(`sprite_${k}`)
      if (!v) continue
      if (v.startsWith('local://')) {
        referencedFiles.add(path.normalize(decodeURIComponent(v.slice('local://'.length))))
      } else if (v.startsWith('file://')) {
        referencedFiles.add(path.normalize(v.replace(/^file:\/\/\/?/, '')))
      }
    }

    // Live2D: keep the whole model folder (textures/motions), not just the json
    const l2d = getConfig('live2d_path')
    if (l2d) {
      referencedFiles.add(l2d)
      referencedDirs.add(path.dirname(l2d))
    }

    for (const entry of fs.readdirSync(avatarsDir)) {
      const full = path.join(avatarsDir, entry)
      let isDir = false
      try { isDir = fs.statSync(full).isDirectory() } catch { continue }
      if (isDir) {
        // Keep referenced Live2D model folders, remove orphans
        if (!referencedDirs.has(full)) {
          fs.rmSync(full, { recursive: true, force: true })
        }
      } else if (!referencedFiles.has(full)) {
        fs.rmSync(full, { force: true })
      }
    }
  } catch {
    // cleanup is best-effort
  }
}

export function getAgent(): Agent {
  return agent
}
