import { powerMonitor } from 'electron'
import { getMainWindow } from '../windowManager'
import { getConfig } from '../../core/config'
import { getCurrentEmotion, emotionToExpression } from '../../core/soul/emotion'
import { getDatabase } from '../../core/database'
import { uuidv4 } from '../../core/utils'
import { getBehaviorStyle, type ReminderTone } from '../../core/soul/personality'

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
    if (!win || win.isDestroyed()) return

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
  if (!win || win.isDestroyed()) return

  const emotion = getCurrentEmotion()
  const hour = new Date().getHours()
  const style = getBehaviorStyle()
  const message = pickMessage(streakMin, hour, emotion.dominantEmotion, style.reminderTone)

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

// Reminders shaped by the pet's personality tone
function pickMessage(streakMin: number, hour: number, dominantEmotion: string, tone: ReminderTone): string {
  const lateNight = hour >= 22 || hour < 6
  const concernPrefix = dominantEmotion === 'lonely' ? pick(['（远远看着你）', '（小声）']) : ''

  if (lateNight) {
    if (tone === 'playful') return pick(['夜猫子…这么晚还在忙，该睡啦！', '月亮都困了，你还不休息呀？'])
    if (tone === 'gentle') return pick(['已经很晚了，我有点担心你。', '这么晚还在忙，要小心身体。'])
    return pick(['很晚了，建议早点休息。', '夜深了，注意身体。'])
  }

  if (streakMin > 120) {
    if (tone === 'playful') return pick(['都连续忙两个多小时了，站起来转一圈嘛！', '你这股劲头…我都替你累，休息下？'])
    if (tone === 'gentle') return pick([`你已经连续工作 ${streakMin} 分钟了，起来活动一下吧。`, '连续这么久不休息，我会担心的。'])
    return pick([`连续工作 ${streakMin} 分钟了，建议休息片刻。`, '长时间工作会影响效率，休息一下。'])
  }

  if (streakMin > 75) {
    if (tone === 'playful') return pick(['喝口水吧，不然我要往你杯子里看啦。', '久坐警告！伸个懒腰也好呀。'])
    if (tone === 'gentle') return pick(['要不要起来走一走？你的肩颈可能有点累。', '喝口水，歇一下眼睛吧。'])
    return pick([`已连续工作 ${streakMin} 分钟，建议起身活动。`, '适当休息有助于保持专注。'])
  }

  if (tone === 'playful') return pick([`${concernPrefix}哇，都忙 ${streakMin} 分钟了，要不要摸个鱼？`, `${concernPrefix}这么久没动，我都要长蘑菇了，歇会儿？`])
  if (tone === 'gentle') return pick([`${concernPrefix}忙了这么久，要不要休息一下？`, `${concernPrefix}感觉你工作很久了，喝口水吧。`])
  return pick([`${concernPrefix}已连续工作 ${streakMin} 分钟，休息一下。`, `${concernPrefix}工作 ${streakMin} 分钟了，休息一下吧。`])
}

export function getGuardianStatus(): { enabled: boolean; workThresholdMin: number; cooldownMin: number } {
  return loadSettings()
}
