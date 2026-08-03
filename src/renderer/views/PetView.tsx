import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { BodyAvatar } from '../avatar/BodyAvatar'
import type { AvatarDescriptor, AnimationState, BodyModifiers, BodyState } from '../../core/avatar/types'
import { computeBodyState } from '../../core/avatar/bodyState'
import { applyBodyPreferences, DEFAULT_BODY_PREFERENCES } from '../../core/avatar/preferences'
import type { BodyPreferences } from '../../core/avatar/preferences'
import { pickActionForExpression, resolveBehaviorState } from '../../core/avatar/actions'
import { classifyTouchContext, worldBodyModifiers } from '../../core/avatar/expressionLayer'
import type { WorldBodySignals } from '../../core/avatar/expressionLayer'
import { comfortFromQuality, emptyClickTracker, qualityStage, trackClick } from '../../core/avatar/touchQuality'
import { emptyLookControl, updateLook } from '../../core/avatar/lookTarget'
import { emptyPresenceBudget, spendPresence, dateKeyOf } from '../../core/avatar/presenceBudget'
import { moodBodyModifiers } from '../../core/soul/moodModel'
import type { MoodState } from '../../core/soul/moodModel'
import type { AvatarExpression } from '../stores/avatarStore'

/** 气泡类型 — 全应用统一，不在别处各自造 */
export type BubbleType = 'normal' | 'care' | 'thinking' | 'warning' | 'greeting'

/** 行为种类 → 气泡类型（生命感表达，不是机械弹窗） */
const KIND_TO_BUBBLE: Record<string, BubbleType> = {
  care: 'care',
  ritual: 'greeting',
  social: 'greeting',
  recollect: 'thinking'
}

interface Bubble { id: number; text: string; type: 'thought' | BubbleType; createdAt: number }
let bubbleId = 0

/** 世界信号未到达时的中性基线（白天、不疲劳、用户在场） */
const NEUTRAL_WORLD: WorldBodySignals = {
  fatigue: 0.2, hourContext: 'day', sleepLate: false,
  busyDeviation: 0, quietDeviation: 0, streakMin: 10, userPresent: true
}

interface PetViewProps {
  /** 当前身体（UI 不知道格式 — Avatar Engine 层决定怎么渲染） */
  body: AvatarDescriptor
  expression?: AvatarExpression
  mood?: string
  /** M3: conversation body state — suspends autonomous motion while in dialogue */
  activity?: string
  /** 长期气质（关系/人格 → 身体基线，Body Expression Layer） */
  temperament?: BodyModifiers
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export const PetView = memo(function PetView({ body, expression, mood, activity = 'idle', temperament, onClick, onContextMenu }: PetViewProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [currentState, setCurrentState] = useState<AnimationState>('idle')
  const [override, setOverride] = useState<AnimationState | null>(null)
  const [attention, setAttention] = useState(false)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [held, setHeld] = useState(false)
  const [prefs, setPrefs] = useState<BodyPreferences>(DEFAULT_BODY_PREFERENCES)
  const [touchQuality, setTouchQuality] = useState(0)
  const [world, setWorld] = useState<WorldBodySignals>(NEUTRAL_WORLD)
  const [moodState, setMoodState] = useState<MoodState>({ valence: 0, arousal: 0.5, label: 'neutral' })
  const walkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevActivity = useRef(activity)
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const lookControl = useRef(emptyLookControl())
  const clickTracker = useRef(emptyClickTracker())
  const presenceBudget = useRef(emptyPresenceBudget(dateKeyOf(Date.now())))
  const prevBodyId = useRef(body.id)

  // 初始化：身体偏好 + 交互质量（Body Memory）+ 世界信号 + 心境
  useEffect(() => {
    window.inkAPI.getBodyPrefs().then(setPrefs).catch(() => {})
    window.inkAPI.getTouchQuality().then(setTouchQuality).catch(() => {})
    const u1 = window.inkAPI.onPetWorld((s) => setWorld(s))
    const u2 = window.inkAPI.onPetMoodState((s) => setMoodState({ valence: s.valence, arousal: s.arousal, label: s.label as MoodState['label'] }))
    return () => { u1(); u2() }
  }, [])

  // Emotional expression → capability-filtered body action（猫摇尾巴/机器人没尾巴就不摇）
  useEffect(() => {
    if (!expression || expression === 'neutral') return
    const actionState = pickActionForExpression(expression, body.capabilities)
    if (actionState === 'idle') return
    setOverride(actionState)
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 8000)
  }, [expression, body.capabilities])

  useEffect(() => () => {
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    if (attentionTimer.current) clearTimeout(attentionTimer.current)
    bubbleTimers.current.forEach(clearTimeout)
  }, [])

  const displayState = override ?? currentState

  useEffect(() => {
    // M3: while a conversation is in flight the pet stops its random wandering —
    // attention is on the user. Only wander when fully idle.
    const conversational = activity !== 'idle'
    if (currentState === 'walk' && !conversational) {
      walkRef.current = setInterval(() => {
        if (dragging.current) return
        window.inkAPI.moveWindowBy(Math.round((Math.random() - 0.5) * 14), Math.round((Math.random() - 0.5) * 6))
      }, 200)
    } else {
      if (walkRef.current) { clearInterval(walkRef.current); walkRef.current = null }
    }
    return () => { if (walkRef.current) clearInterval(walkRef.current) }
  }, [currentState, activity])

  // 情绪/活动/心境/气质/世界 → 身体参数（连续表达层）
  const bodyState: BodyState = useMemo(() => {
    const raw = computeBodyState({
      expression: expression ?? 'neutral',
      activity,
      mood: mood ?? 'neutral',
      state: displayState,
      look,
      touchComfort: comfortFromQuality(touchQuality),
      temperament,
      world: worldBodyModifiers(world),
      moodModifiers: moodBodyModifiers(moodState)
    })
    return applyBodyPreferences(raw, prefs)
  }, [expression, activity, mood, displayState, look, prefs, touchQuality, temperament, world, moodState])

  // 视线频率跟随情绪（开心/对话中更常看你），供游标事件读取
  const lookFreqRef = useRef(bodyState.lookFrequency)
  useEffect(() => { lookFreqRef.current = bodyState.lookFrequency }, [bodyState.lookFrequency])

  // Sprite 活体化：视线跟随（偶尔偷看）— 主进程约 5Hz 推送游标
  // Presence Budget：主动注视每天有上限——生命感来自稀缺
  useEffect(() => {
    const unsub = window.inkAPI.onAvatarCursor((cursor) => {
      const prevActive = lookControl.current.active
      const next = updateLook(cursor, lookControl.current, Date.now(), lookFreqRef.current)
      if (next.active && !prevActive) {
        const spend = spendPresence(presenceBudget.current, 'glance', Date.now(), { userPresent: world.userPresent ?? true })
        presenceBudget.current = spend.state
        if (!spend.allowed) {
          // 今天的注视预算用完：安静下来，不是显得更急
          lookControl.current = { active: false, until: 0, x: 0, y: 0 }
          setLook({ x: 0, y: 0 })
          return
        }
      }
      lookControl.current = next
      setLook({ x: next.x, y: next.y })
    })
    return unsub
  }, [])

  // 换身体：不是"新角色登场"，而是"换了一身新衣服"
  useEffect(() => {
    if (prevBodyId.current === body.id) return
    prevBodyId.current = body.id
    const t = setTimeout(() => showBubble('（换了一身新衣服…）', 'thought'), 700)
    bubbleTimers.current.push(t)
  }, [body.id])

  // 气泡的生命节奏：砚灵先看向你（attention），停顿，气泡再淡入
  const showBubble = useCallback((text: string, type: 'thought' | BubbleType = 'normal') => {
    const id = ++bubbleId
    setAttention(true)
    if (attentionTimer.current) clearTimeout(attentionTimer.current)
    attentionTimer.current = setTimeout(() => setAttention(false), 600)

    const t = setTimeout(() => {
      setBubbles(prev => [...prev.slice(-2), { id, text, type, createdAt: Date.now() }])
      const i = bubbleTimers.current.indexOf(t)
      if (i >= 0) bubbleTimers.current.splice(i, 1)
    }, type === 'thinking' ? 500 : 350)
    bubbleTimers.current.push(t)
    const hide = setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id))
      const i = bubbleTimers.current.indexOf(hide)
      if (i >= 0) bubbleTimers.current.splice(i, 1)
    }, 4000 + text.length * 30 + 500)
    bubbleTimers.current.push(hide)
  }, [])

  useEffect(() => {
    const u1 = window.inkAPI.onPetBehavior(({ behavior }) => {
      // 行为 → 状态，按身体能力降级（没有 motion 的身体不会收到 walk/sit/sleep）
      setCurrentState(resolveBehaviorState(behavior, body.capabilities))
    })
    const u2 = window.inkAPI.onPetSpeak(({ message, action }) => showBubble(message, KIND_TO_BUBBLE[action] ?? 'normal'))
    const u3 = window.inkAPI.onPetThought(({ thought }) => showBubble(thought, 'thinking'))
    const u4 = window.inkAPI.onPetUserReturned(() => {})
    return () => { u1(); u2(); u3(); u4() }
  }, [showBubble, body.capabilities])

  // AI 状态 → 身体反馈：思考中会"看向你"，大脑失联时轻轻嘀咕一句
  useEffect(() => {
    if (activity === 'thinking' && prevActivity.current !== 'thinking') {
      setAttention(true)
      if (attentionTimer.current) clearTimeout(attentionTimer.current)
      attentionTimer.current = setTimeout(() => setAttention(false), 1200)
    }
    if (activity === 'error' && prevActivity.current !== 'error') {
      showBubble('（大脑好像暂时联系不上…）', 'thinking')
    }
    prevActivity.current = activity
  }, [activity, showBubble])

  /** 交互质量（Body Memory v2）：高质量互动多加分，刷屏扣分 */
  const recordInteraction = useCallback((kind: 'touch' | 'comfort' | 'respond' | 'spam') => {
    window.inkAPI.addInteraction(kind).then(setTouchQuality).catch(() => {})
  }, [])

  /** 轻触反应：不是"点了按钮"，是"被摸了一下"；语境决定温度 */
  const touchReaction = useCallback(() => {
    if (!prefs.touchFeel) return

    // 刷屏检测：疯狂连点不算互动，过载会"有点晕"
    const now = Date.now()
    const t = trackClick(clickTracker.current, now)
    clickTracker.current = t.state
    if (t.batch === 'spam') {
      recordInteraction('spam')
      if (t.overload) {
        showBubble('（有点晕……让我休息一下）', 'thinking')
        setOverride('sit')
        if (overrideTimer.current) clearTimeout(overrideTimer.current)
        overrideTimer.current = setTimeout(() => setOverride(null), 25000)
      }
      return
    }
    recordInteraction('touch')

    setAttention(true)
    if (attentionTimer.current) clearTimeout(attentionTimer.current)

    const ctx = classifyTouchContext(world, mood ?? 'neutral', activity)
    if (ctx === 'gentle') {
      // 深夜/疲惫：安静回应 —— 只看你一眼，轻轻靠过来
      attentionTimer.current = setTimeout(() => setAttention(false), 900)
      setOverride('happy')
      if (overrideTimer.current) clearTimeout(overrideTimer.current)
      overrideTimer.current = setTimeout(() => setOverride(null), 1200)
    } else if (ctx === 'lively') {
      // 下午开心：活跃回应
      attentionTimer.current = setTimeout(() => setAttention(false), 700)
      setOverride('happy')
      if (overrideTimer.current) clearTimeout(overrideTimer.current)
      overrideTimer.current = setTimeout(() => setOverride(null), 2500)
    } else {
      attentionTimer.current = setTimeout(() => setAttention(false), 700)
      setOverride('happy')
      if (overrideTimer.current) clearTimeout(overrideTimer.current)
      overrideTimer.current = setTimeout(() => setOverride(null), 2000)
    }
  }, [prefs.touchFeel, world, mood, activity, recordInteraction, showBubble])

  /** 被抓住：先惊讶，再被提着 */
  const grabbedReaction = useCallback(() => {
    if (!prefs.touchFeel) return
    setOverride('surprised')
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 1500)
    recordInteraction('touch')
  }, [recordInteraction, prefs.touchFeel])

  /** 放下后恢复：开心 + 惯性晃动（held→false 触发着色器弹性摆动） */
  const onReleased = useCallback(() => {
    if (!prefs.touchFeel) return
    setOverride('happy')
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => setOverride(null), 4000)
    recordInteraction('touch')
  }, [recordInteraction, prefs.touchFeel])

  // Safety net: if the mouse is released outside the window during a drag,
  // make sure the drag session is always ended
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        setHeld(false)
        onReleased()
        window.inkAPI.endWindowDrag()
      }
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [onReleased])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { onContextMenu(e); return }
    dragging.current = false
    startPos.current = { x: e.screenX, y: e.screenY }
    window.inkAPI.startWindowDrag()
  }, [onContextMenu])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!(e.buttons & 1)) return
    const dx = e.screenX - startPos.current.x
    const dy = e.screenY - startPos.current.y
    if (!dragging.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragging.current = true
      setHeld(true)
      grabbedReaction()
    }
    if (dragging.current) {
      window.inkAPI.updateWindowDrag()
    }
  }, [grabbedReaction])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { dragging.current = false; return }
    if (dragging.current) {
      // 被拖着走了一路 — 放下后：开心 + 惯性晃动
      onReleased()
    } else {
      // 轻触：先有反应，再打开面板（不是"点了软件"）
      touchReaction()
      onClick()
    }
    setHeld(false)
    window.inkAPI.endWindowDrag()
    dragging.current = false
  }, [onClick, touchReaction, onReleased])

  const moodClass = mood && mood !== 'neutral' ? `mood-${mood}` : ''

  return (
    <div
      className={`pet-view ${moodClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {mood === 'sleepy' && <div className="pet-zzz">z Z z</div>}
      <div className={attention ? 'pet-attention' : ''}>
        <BodyAvatar body={body} state={displayState} bodyState={bodyState} size={140} held={held} />
      </div>
      {bubbles.map((b, i) => (
        <div key={b.id} className={`pet-bubble ${b.type === 'thought' ? 'thought' : b.type}`} style={{ position: 'absolute', top: 6 + i * 42, left: '50%', transform: 'translateX(-50%)', ['--bubble-delay' as any]: `${i * 0.15}s` }}>
          {b.text}
        </div>
      ))}
    </div>
  )
})
