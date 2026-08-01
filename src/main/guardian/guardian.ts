import { powerMonitor } from 'electron'
import { getMainWindow } from '../windowManager'
import { getConfig } from '../../core/config'
import { getCurrentEmotion, emotionToExpression } from '../../core/soul/emotion'
import { getDatabase } from '../../core/database'
import { uuidv4 } from '../../core/utils'

interface GuardianSettings {
  enabled: boolean
  workThresholdMin: number
  cooldownMin: number
}

function loadSettings(): GuardianSettings {
  return {
    enabled: getConfig('guardian_enabled') !== 'false',
    workThresholdMin: Number(getConfig('guardian_work_threshold_min') || 45),
    cooldownMin: Number(getConfig('guardian_cooldown_min') || 60)
  }
}

export function startGuardian(): () => void {
  let workStreakStart = 0
  let lastReminderAt = 0
  let wasIdle = true

  const tick = () => {
    const win = getMainWindow()
    if (!win) return

    const settings = loadSettings()
    if (!settings.enabled) {
      wasIdle = true
      workStreakStart = 0
      return
    }

    const idleSec = powerMonitor.getSystemIdleTime()
    const isIdle = idleSec >= 45

    if (isIdle) {
      wasIdle = true
      workStreakStart = 0
      return
    }

    if (wasIdle) {
      wasIdle = false
      workStreakStart = Date.now()
    }

    const streakMin = (Date.now() - workStreakStart) / 60000
    const sinceLastMin = (Date.now() - lastReminderAt) / 60000

    if (streakMin >= settings.workThresholdMin && sinceLastMin >= settings.cooldownMin) {
      lastReminderAt = Date.now()
      remind(Math.round(streakMin))
    }
  }

  const interval = setInterval(tick, 30000)
  return () => clearInterval(interval)
}

function remind(streakMin: number): void {
  const win = getMainWindow()
  if (!win) return

  const emotion = getCurrentEmotion()
  const hour = new Date().getHours()
  const message = pickMessage(streakMin, hour, emotion.dominantEmotion)

  win.webContents.send('pet:speak', { message, action: 'remind' })
  win.webContents.send('pet:expression', { expression: emotionToExpression(emotion.dominantEmotion) })
  win.webContents.send('pet:behavior', { behavior: 'look_around' })

  try {
    const db = getDatabase()
    db.prepare(
      'INSERT INTO behavior_logs (id, behavior_id, triggered_by, outcome, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), 'guardian', 'system', JSON.stringify({ message, streakMin }), Date.now())
  } catch {
    // logging is best-effort
  }
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)]
}

function pickMessage(streakMin: number, hour: number, dominantEmotion: string): string {
  const lateNight = hour >= 22 || hour < 6

  if (lateNight) {
    return pick([
      '这么晚了还在忙吗…我有点担心你。',
      '已经很晚了，小心身体呀。',
      '夜色这么深，你还在认真工作呢。'
    ])
  }

  if (streakMin > 90) {
    return pick([
      `你已经连续工作 ${streakMin} 分钟了，起来活动一下吧。`,
      '连续这么久不休息，我会担心的。',
      '要不要站起来走走？你的肩颈在抗议了。'
    ])
  }

  const concernPrefix = dominantEmotion === 'lonely'
    ? pick(['（远远看着你）', '（小声）'])
    : ''

  return pick([
    `${concernPrefix}忙了这么久，要不要休息一下？`,
    `${concernPrefix}感觉你工作很久了，喝口水吧。`,
    `连续工作 ${streakMin} 分钟了，休息一下吧。`
  ])
}

export function getGuardianStatus(): { enabled: boolean; workThresholdMin: number; cooldownMin: number } {
  return loadSettings()
}
