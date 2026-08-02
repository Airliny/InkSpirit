import { describe, it, expect } from 'vitest'
import {
  buildBodyDescriptors,
  resolveCurrentBodyId,
  bodySwitchConfigKeys,
  BUILTIN_BODY_ID,
  SPRITE_BODY_ID,
  LIVE2D_BODY_ID,
  VRM_BODY_ID
} from './bodies'

describe('Avatar 身体描述符', () => {
  it('只有内置身体时（全新用户）', () => {
    const bodies = buildBodyDescriptors({}, null, null)
    expect(bodies.map((b) => b.id)).toEqual([BUILTIN_BODY_ID])
  })

  it('有精灵图资产 → 精灵图身体出现', () => {
    const bodies = buildBodyDescriptors({ idle: 'local://a.png' }, null, null)
    expect(bodies.some((b) => b.type === 'sprite')).toBe(true)
  })

  it('有 Live2D 模型 → Live2D 身体出现', () => {
    const bodies = buildBodyDescriptors({}, '/data/live2d/model.model3.json', null)
    expect(bodies.some((b) => b.type === 'live2d')).toBe(true)
  })

  it('有 VRM 模型 → 3D 身体出现（新身体类型，不是"支持 VRM 模型"）', () => {
    const bodies = buildBodyDescriptors({}, null, '/data/body/model.vrm')
    const vrm = bodies.find((b) => b.type === 'vrm')!
    expect(vrm.name).toBe('3D 身体')
    expect(vrm.capabilities.skeleton).toBe(true)
  })

  it('身体按能力声明自己会什么（Body Personality）', () => {
    const bodies = buildBodyDescriptors({ idle: 'x.png' }, '/m.model3.json', '/b.vrm')
    const sprite = bodies.find((b) => b.type === 'sprite')!
    expect(sprite.capabilities.look).toBe(true)
    expect(sprite.capabilities.sway).toBe(true)
    const l2d = bodies.find((b) => b.type === 'live2d')!
    expect(l2d.capabilities.blink).toBe(true)
    expect(l2d.capabilities.sway).toBe(false)
    expect(l2d.capabilities.tail).toBeUndefined()
    const vrm = bodies.find((b) => b.type === 'vrm')!
    expect(vrm.capabilities.look).toBe(true)
    expect(vrm.capabilities.motion).toBe(true)
  })
})

describe('当前身体解析', () => {
  const bodies = buildBodyDescriptors({ idle: 'x.png' }, '/m.model3.json', '/b.vrm')

  it('显式选择优先', () => {
    expect(resolveCurrentBodyId(LIVE2D_BODY_ID, 'sprites', bodies)).toBe(LIVE2D_BODY_ID)
    expect(resolveCurrentBodyId(VRM_BODY_ID, 'sprites', bodies)).toBe(VRM_BODY_ID)
  })

  it('没有显式选择 → 按旧配置推导（老用户升级不丢身体）', () => {
    expect(resolveCurrentBodyId(null, 'live2d', bodies)).toBe(LIVE2D_BODY_ID)
    expect(resolveCurrentBodyId(null, 'vrm', bodies)).toBe(VRM_BODY_ID)
    expect(resolveCurrentBodyId(null, 'sprites', bodies)).toBe(SPRITE_BODY_ID)
    expect(resolveCurrentBodyId(null, 'sprites', [bodies[0]])).toBe(BUILTIN_BODY_ID)
  })

  it('显式选择已失效（资产被删）→ 回退推导', () => {
    const onlyBuiltin = [bodies[0]]
    expect(resolveCurrentBodyId(LIVE2D_BODY_ID, 'sprites', onlyBuiltin)).toBe(BUILTIN_BODY_ID)
  })
})

describe('换身体边界 — 身体不动灵魂', () => {
  it('换身体只写身体指向键', () => {
    const keys = bodySwitchConfigKeys()
    expect(keys).toContain('current_avatar_id')
    expect(keys).toContain('model_type')
  })

  it('灵魂键绝不在换身体写入范围', () => {
    const soulKeys = ['pet_name', 'identity_events', 'personality_*', 'relationship_*', 'memory_*', 'emotion_*']
    const keys = new Set(bodySwitchConfigKeys())
    for (const k of soulKeys) expect(keys.has(k)).toBe(false)
  })
})
