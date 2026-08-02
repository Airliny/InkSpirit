import { describe, it, expect } from 'vitest'
import { computeMood, moodLabel, moodBodyModifiers, moodLine, MOOD_WINDOW_MS } from './mood'

const NOW = 1_000_000_000_000
const H = 60 * 60 * 1000

function sample(valence: number, arousal: number, ageMs: number) {
  return { valence, arousal, timestamp: NOW - ageMs }
}

describe('Mood（心境）— Emotion→Mood→Temperament 三层中间层', () => {
  it('无快照 → 中性', () => {
    const m = computeMood([], NOW)
    expect(m.label).toBe('neutral')
    expect(m.valence).toBe(0)
  })

  it('最近一直开心活跃 → energetic', () => {
    const m = computeMood([
      sample(0.7, 0.8, 1 * H), sample(0.6, 0.7, 2 * H), sample(0.5, 0.6, 3 * H)
    ], NOW)
    expect(m.label).toBe('energetic')
  })

  it('最近整体不开心 → blue/low', () => {
    const m = computeMood([
      sample(-0.5, 0.3, 1 * H), sample(-0.6, 0.2, 2 * H), sample(-0.4, 0.3, 3 * H)
    ], NOW)
    expect(['blue', 'low']).toContain(m.label)
  })

  it('旧情绪被时间淡化（24h 外不算，6h 半衰）', () => {
    // 昨天开心今天难过：今天整体应该偏低沉
    const m = computeMood([
      sample(0.8, 0.8, 30 * H),  // 超窗口，忽略
      sample(-0.5, 0.3, 1 * H)
    ], NOW)
    expect(m.valence).toBeLessThan(0)
  })

  it('窗口边界：刚好 24h 内的算，超过不算', () => {
    const inside = computeMood([sample(0.5, 0.5, MOOD_WINDOW_MS - 1000)], NOW)
    const outside = computeMood([sample(0.5, 0.5, MOOD_WINDOW_MS + 1000)], NOW)
    expect(inside.valence).toBeGreaterThan(0)
    expect(outside.label).toBe('neutral')
  })
})

describe('moodLabel 边界', () => {
  it('高兴但平静 → content（不是 energetic）', () => {
    expect(moodLabel(0.3, 0.3)).toBe('content')
  })
  it('负面且低活跃 → blue；负面但高活跃 → low', () => {
    expect(moodLabel(-0.3, 0.3)).toBe('blue')
    expect(moodLabel(-0.3, 0.6)).toBe('low')
  })
  it('中性区 → neutral', () => {
    expect(moodLabel(0.05, 0.5)).toBe('neutral')
  })
})

describe('Mood → Body（心境进入身体，小时~天尺度）', () => {
  it('content：能量/视线/摆动略升', () => {
    const m = moodBodyModifiers(computeMood([sample(0.5, 0.4, 1 * H)], NOW))
    expect(m.energyScale).toBeGreaterThan(1)
    expect(m.lookScale).toBeGreaterThan(1)
  })

  it('blue：能量/视线下降（今天低沉，身体安静）', () => {
    const m = moodBodyModifiers(computeMood([sample(-0.5, 0.3, 1 * H)], NOW))
    expect(m.energyScale).toBeLessThan(1)
    expect(m.lookScale).toBeLessThan(1)
    expect(m.movementScale).toBeLessThan(1)
  })

  it('neutral：不调制', () => {
    const m = moodBodyModifiers({ valence: 0, arousal: 0.5, label: 'neutral' })
    expect(m.energyScale).toBe(1)
  })
})

describe('moodLine — 进提示词的一句话', () => {
  it('只有非中性才有台词', () => {
    expect(moodLine({ valence: 0.5, arousal: 0.6, label: 'energetic' })).toBeTruthy()
    expect(moodLine({ valence: 0, arousal: 0.5, label: 'neutral' })).toBeNull()
  })
})
