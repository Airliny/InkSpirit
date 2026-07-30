import { app, BrowserWindow } from 'electron'
import { createMainWindow, getMainWindow } from './windowManager'
import { createTray } from './trayManager'
import { registerIpcHandlers } from './ipc/index'
import { getDatabase, closeDatabase } from '../core/database'
import { Agent } from '../core/agent'
import { startActivityMonitor } from './perception'
import { markActive, markIdle, getTotalWorkMinutes } from './perception/timeTracker'
import { getCurrentEmotion, forgiveEmotion, applyEmotionDecay } from '../core/soul/emotion'
import { getRelationship } from '../core/soul/relationship'
import { tick, getPetState, type BehaviorImpulse } from '../core/autonomy/drives'

let agent: Agent
let userIdleMs = 0
let totalWorkMin = 0
let lastImpulseWasAt = Date.now()

app.whenReady().then(() => {
  getDatabase()
  agent = new Agent()
  const win = createMainWindow()
  createTray(win)
  registerIpcHandlers(agent)
  startPerception()
  startHeartbeat()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})

function startPerception(): void {
  startActivityMonitor(
    () => { userIdleMs = 0; markActive() },
    (idleMs) => { userIdleMs = idleMs; markIdle(); totalWorkMin = getTotalWorkMinutes() },
    30000
  )
  setInterval(() => { totalWorkMin = getTotalWorkMinutes() }, 60000)
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
    }

    // Forgiveness and emotional decay over time
    if (Math.random() < 0.1) {
      forgiveEmotion(0.003)
      applyEmotionDecay()
    }
  }, tickRate)
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
  if (win) win.webContents.send(channel, data)
}

export function getAgent(): Agent {
  return agent
}
