import { app, BrowserWindow, protocol, net, powerMonitor } from 'electron'
import { createMainWindow, getMainWindow } from './windowManager'
import { createTray } from './trayManager'
import { registerIpcHandlers } from './ipc/index'
import { getDatabase, closeDatabase } from '../core/database'
import { Agent } from '../core/agent'
import { markActive, markIdle, getTotalWorkMinutes } from './perception/timeTracker'
import { startGuardian } from './guardian/guardian'
import { initUpdater } from './updater/updater'
import { getCurrentEmotion, forgiveEmotion, applyEmotionDecay, emotionToExpression, flushEmotion, type EmotionState } from '../core/soul/emotion'
import { getRelationship } from '../core/soul/relationship'
import { tick, getPetState, type BehaviorImpulse } from '../core/autonomy/drives'
import { getBehaviorStyle } from '../core/soul/personality'
import { getMemorableMemory, consolidateMemories, decayMemories } from '../core/soul/memory'
import { pathToFileURL } from 'url'
import { migrateToSecure } from '../core/secureStore'
import { preloadConfig, getConfig, setConfig } from '../core/config'
import { uuidv4 } from '../core/utils'
import fs from 'fs'
import path from 'path'

let agent: Agent
let userIdleMs = 0
let totalWorkMin = 0
let lastImpulseWasAt = Date.now()

app.whenReady().then(() => {
  console.log(`[InkSpirit] v${app.getVersion()} starting. userData: ${app.getPath('userData')}`)
  protocol.handle('local', (request) => {
    const encoded = request.url.substring('local://'.length)
    const filePath = decodeURIComponent(encoded)
    const fileUrl = pathToFileURL(filePath).href
    return net.fetch(fileUrl)
  })

  getDatabase()
  preloadConfig()
  // Migrate legacy plaintext API keys to encrypted storage
  for (const p of ['openai', 'anthropic', 'deepseek']) {
    migrateToSecure(`${p}_api_key`)
  }
  agent = new Agent()
  cleanupOrphanAvatars()
  const win = createMainWindow()
  createTray(win)
  registerIpcHandlers(agent)
  startPerception()
  startHeartbeat()
  startGuardian()
  startMoodSync()
  startRecollection()
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
        // The pet noticed the user coming back after a long absence
        if (idleStartedAt && Date.now() - idleStartedAt > 30 * 60 * 1000) {
          emit('pet:speak', { message: pickWelcomeMessage(), action: 'welcome' })
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

function pickWelcomeMessage(): string {
  const emotion = getCurrentEmotion()
  const hour = new Date().getHours()
  const lateNight = hour >= 22 || hour < 6

  if (lateNight) return '这么晚才回来…我有点担心。'
  if (emotion.dominantEmotion === 'lonely' || emotion.loneliness > 0.4) return '你终于回来了…（轻轻靠过来）'
  if (emotion.grudge > 0.5) return '……回来了。'
  return pick([
    '你回来啦！', '好久不见，想我了吗？', '欢迎回来~', '（远远看到你，眼睛亮了）'
  ])
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)]
}

// ---- Heartbeat: drive-based, irregular ----

function startHeartbeat(): void {
  // Tick every ~8 seconds with some jitter
  const tickRate = 8000 + Math.random() * 4000

  setInterval(() => {
    const elapsed = (Date.now() - lastImpulseWasAt) / 1000
    const impulse = tick(elapsed, userIdleMs)
    lastImpulseWasAt = Date.now()

    if (impulse.type !== 'none') {
      actOnImpulse(impulse)
    } else {
      // No strong drive right now: emit a natural idle behavior as the single
      // source of animation state, weighted by current energy
      emitIdleBehavior()
      // The pet actively finds things to do every few ticks
      if (Math.random() < 0.5) {
        maybeProactiveAction()
      }
    }

    // Daily rituals (morning / good night), checked occasionally
    if (Math.random() < 0.2) {
      maybeDailyRitual()
    }

    // Forgiveness and emotional decay over time
    if (Math.random() < 0.1) {
      forgiveEmotion(0.003)
      applyEmotionDecay()
    }
  }, tickRate)
}

// Single behavior source for the renderer: idle actions weighted by soul energy
function emitIdleBehavior(): void {
  const emotion = getCurrentEmotion()
  const style = getBehaviorStyle()
  const rand = Math.random()

  if (emotion.energy < 0.3) {
    const pool = ['sit', 'yawn', 'blink', 'sit', 'sleep']
    emit('pet:behavior', { behavior: pool[Math.floor(Math.random() * pool.length)] })
  } else if (emotion.energy > 0.7) {
    const pool = ['stretch', 'walk', 'look_around', 'stretch']
    emit('pet:behavior', { behavior: pool[Math.floor(Math.random() * pool.length)] })
  } else if (rand < 0.35) {
    emit('pet:behavior', { behavior: 'blink' })
  } else if (rand < 0.55) {
    emit('pet:behavior', { behavior: 'look_around' })
  } else if (rand < 0.75) {
    emit('pet:behavior', { behavior: 'idle' })
  } else {
    emit('pet:behavior', { behavior: 'stretch' })
  }

  // Curiosity / expressiveness shows up as occasional inner thoughts while idle
  if (Math.random() < style.idleThoughtChance) {
    const thoughts = [
      '（发呆）', '（在想事情）', '（望向窗外）', '（轻轻哼着什么）',
      '（数着时间）', '（打了个哈欠）', '（看了看你）', '（伸了个懒腰）'
    ]
    emit('pet:thought', { thought: thoughts[Math.floor(Math.random() * thoughts.length)] })
  }

  // Proactive pets occasionally reach out when the user is around
  if (userIdleMs < 60000 && Math.random() < style.greetFrequency * 0.06) {
    const greetPool = [
      '在忙什么呢？', '（悄悄看了你一眼）', '感觉好久没聊天了。',
      '我刚在想，你好像心情不错？', '嗯…没事，就想看看你在不在。'
    ]
    emit('pet:speak', { message: greetPool[Math.floor(Math.random() * greetPool.length)], action: 'greet' })
  }
}

// ---- Proactive actions: the pet actively finds things to do ----

function maybeProactiveAction(): void {
  if (userIdleMs > 90000) return // user is away — don't disturb
  const emotion = getCurrentEmotion()
  const style = getBehaviorStyle()
  const r = Math.random()

  // Curious watching while the user is active
  if (r < 0.3) {
    emit('pet:behavior', { behavior: 'look_around' })
    if (Math.random() < 0.45) {
      const watching = [
        '（看着你忙碌）', '（歪头看了看你）', '（凑近屏幕边）',
        '（注意到你在打字）', '（好奇地看了你一眼）'
      ]
      emit('pet:thought', { thought: watching[Math.floor(Math.random() * watching.length)] })
    }
    return
  }

  // Self-entertainment: playful pets move around more when happy
  if (r < 0.55 && emotion.happiness > 0.6 && emotion.energy > 0.5) {
    const pool = ['walk', 'stretch', 'walk', 'look_around']
    emit('pet:behavior', { behavior: pool[Math.floor(Math.random() * pool.length)] })
    if (Math.random() < 0.35) {
      emit('pet:thought', { thought: '（自己玩得很开心）' })
    }
    return
  }

  // Reach out more often than before
  if (r > 0.8 && Math.random() < style.greetFrequency * 0.5) {
    const greetPool = [
      '在忙什么呢？', '（悄悄看了你一眼）', '感觉好久没聊天了。',
      '我刚在想，你好像心情不错？', '嗯…没事，就想看看你在不在。',
      '（轻轻戳了戳空气）嘿。', '要不要歇会儿聊两句？'
    ]
    emit('pet:speak', { message: greetPool[Math.floor(Math.random() * greetPool.length)], action: 'greet' })
  }
}

// ---- Daily rituals: morning greeting & good night, once per day ----

function maybeDailyRitual(): void {
  const hour = new Date().getHours()
  const today = new Date().toDateString()
  const lastGreeting = getConfig('last_greeting_date')
  const lastNight = getConfig('last_night_date')
  const emotion = getCurrentEmotion()

  if (hour >= 7 && hour <= 10 && lastGreeting !== today && userIdleMs < 120000) {
    setConfig('last_greeting_date', today)
    const greetings = [
      '早呀，新的一天。', '早上好。今天想做点什么？',
      '（伸个懒腰）早~', '新的一天开始了，一起加油。'
    ]
    emit('pet:speak', { message: greetings[Math.floor(Math.random() * greetings.length)], action: 'greet' })
    return
  }

  if (hour >= 22 && hour < 24 && lastNight !== today && userIdleMs < 120000) {
    setConfig('last_night_date', today)
    const nights = emotion.happiness > 0.5
      ? ['晚安，明天见。', '今天也很开心，晚安~']
      : ['晚安…明天会更好的。', '我守着你，晚安。']
    emit('pet:speak', { message: nights[Math.floor(Math.random() * nights.length)], action: 'night' })
  }
}

// ---- Natural recollection: the pet occasionally brings up old memories ----

function startRecollection(): void {
  let lastRecollectionAt = 0
  setInterval(() => {
    // Only when the user is active and enough time has passed since last time
    if (userIdleMs > 120000) return
    if (Date.now() - lastRecollectionAt < 3 * 60 * 60 * 1000) return
    if (Math.random() > 0.35) return

    const mem = getMemorableMemory()
    if (!mem) return

    lastRecollectionAt = Date.now()
    const snippet = mem.content.length > 24 ? mem.content.slice(0, 24) + '…' : mem.content
    emit('pet:speak', {
      message: `（忽然想起）你之前说「${snippet}」…`,
      action: 'recollect'
    })
  }, 60 * 60 * 1000)
}

function actOnImpulse(impulse: BehaviorImpulse): void {
  const emotion = getCurrentEmotion()

  switch (impulse.type) {
    case 'move':
      // Walk around or just stretch, depending on intensity
      if (impulse.intensity > 0.7) {
        emit('pet:behavior', { behavior: 'walk' })
      } else {
        emit('pet:behavior', { behavior: Math.random() < 0.5 ? 'stretch' : 'walk' })
      }
      break

    case 'rest':
      emit('pet:behavior', { behavior: impulse.intensity > 0.8 ? 'sleep' : 'sit' })
      break

    case 'explore':
      emit('pet:behavior', { behavior: 'look_around' })
      break

    case 'socialize':
      // Generate a natural social message based on emotion and relationship
      {
        const rel = getRelationship()
        const msg = generateSocialMessage(emotion, rel.stage, impulse)
        emit('pet:speak', { message: msg, action: 'greet' })
      }
      break

    case 'self_soothe':
      emit('pet:behavior', { behavior: 'sit' })
      emit('pet:thought', { thought: impulse.reason })
      break

    case 'play':
      emit('pet:behavior', { behavior: 'walk' })
      if (emotion.happiness > 0.7) {
        emit('pet:expression', { expression: 'happy' })
      }
      break

    case 'think':
      if (impulse.thought) {
        emit('pet:thought', { thought: impulse.thought })
      }
      break
  }

  // Check inner thought from drive system
  const { innerThought } = getPetState()
  if (innerThought) {
    emit('pet:thought', { thought: innerThought })
  }
}

function generateSocialMessage(
  emotion: ReturnType<typeof getCurrentEmotion>,
  stage: string,
  impulse: BehaviorImpulse
): string {
  if (impulse.type !== 'socialize') return ''

  const dom = emotion.dominantEmotion

  if (dom === 'lonely' || emotion.sadness > 0.5) {
    return impulse.urgency > 0.7
      ? '好想你...'
      : '（小声）有人在吗...'
  }

  if (dom === 'jealous') {
    return Math.random() < 0.5 ? '哼...' : '（瞥了一眼又转回去）'
  }

  if (dom === 'happy' || dom === 'excited') {
    const happyGreetings = [
      '在干嘛呀？', '今天天气真好！', '嘿嘿~', '主人！'
    ]
    return happyGreetings[Math.floor(Math.random() * happyGreetings.length)]
  }

  if (dom === 'curious') {
    return '你在做什么呢？'
  }

  // Default: gentle presence
  const casual = [
    '我在呢。', '嗯~', '（轻轻碰了碰你）', '...'
  ]
  return casual[Math.floor(Math.random() * casual.length)]
}

function emit(channel: string, data: Record<string, unknown>): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

// ---- Mood sync: push real soul state to the renderer ----

let lastStage: string | null = null

const STAGE_UP_MESSAGES: Record<string, string> = {
  acquaintance: '（忽然）我们好像…越来越熟了。',
  friend: '你在我心里，已经是朋友了。',
  close_friend: '总觉得，和你待着就很安心。',
  partner: '……有你陪着，真好。'
}

function startMoodSync(): void {
  setInterval(() => {
    const emotion = getCurrentEmotion()

    // Relationship growth is acknowledged by the pet itself
    const stage = getRelationship().stage
    if (lastStage && lastStage !== stage && STAGE_UP_MESSAGES[stage]) {
      emit('pet:speak', { message: STAGE_UP_MESSAGES[stage], action: 'grow' })
    }
    lastStage = stage

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

    const referenced = new Set<string>()
    const spriteKeys = ['idle', 'walk', 'sleep', 'sit', 'stretch', 'yawn', 'surprised', 'happy', 'sad', 'love']
    for (const k of spriteKeys) {
      const v = getConfig(`sprite_${k}`)
      if (v && v.startsWith('local://')) {
        referenced.add(decodeURIComponent(v.slice('local://'.length)))
      }
    }
    const l2d = getConfig('live2d_path')
    if (l2d) referenced.add(l2d)

    for (const entry of fs.readdirSync(avatarsDir)) {
      const full = path.join(avatarsDir, entry)
      if (!referenced.has(full)) {
        fs.rmSync(full, { recursive: true, force: true })
      }
    }
  } catch {
    // cleanup is best-effort
  }
}

export function getAgent(): Agent {
  return agent
}
