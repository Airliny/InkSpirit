import { describe, it, expect } from 'vitest'
import { buildBodyDescriptors, resolveCurrentBodyId, BUILTIN_BODY_ID, BUILTIN_BODY_DESCRIPTOR, SPRITE_BODY_ID, LIVE2D_BODY_ID, VRM_BODY_ID } from './avatar/bodies'
import type { SpriteSource } from './avatar/types'

/**
 * First Launch Test（P5）—— 全新安装的降级链：
 * 无任何资产 → 身体列表恒含内置「砚」，当前身体解析必为内置。
 * 纯逻辑测试，不依赖数据库/GPU（渲染层失败另有回退链测试）。
 */

describe('全新安装：无任何模型资产', () => {
  it('身体列表永远不为空（内置「砚」是一等公民）', () => {
    const bodies = buildBodyDescriptors({}, null, null)
    expect(bodies.length).toBeGreaterThan(0)
    expect(bodies[0].id).toBe(BUILTIN_BODY_ID)
    expect(bodies[0].type).toBe('builtin')
  })

  it('BUILTIN_BODY_DESCRIPTOR 恒可用：无需 IPC/资产，渲染层可直接兜底', () => {
    // v0.9.2-rc2 P0：currentBody 为空（IPC 挂死/列表空）→ 渲染层用纯客户端常量兜底
    expect(BUILTIN_BODY_DESCRIPTOR.id).toBe(BUILTIN_BODY_ID)
    expect(BUILTIN_BODY_DESCRIPTOR.type).toBe('builtin')
    expect(BUILTIN_BODY_DESCRIPTOR.source.kind).toBe('builtin')
    expect(BUILTIN_BODY_DESCRIPTOR).toEqual(buildBodyDescriptors({}, null, null)[0])
  })

  it('当前身体解析 → 内置「砚」', () => {
    const bodies = buildBodyDescriptors({}, null, null)
    expect(resolveCurrentBodyId(null, '', bodies)).toBe(BUILTIN_BODY_ID)
    // 损坏的显式选择（指向不存在的身体）→ 回退内置
    expect(resolveCurrentBodyId('ghost_body', 'sprites', bodies)).toBe(BUILTIN_BODY_ID)
  })
})

describe('部分资产：老用户升级 / 只导入了部分精灵图', () => {
  it('只有 idle 一张图 → 精灵图身体可用，且不覆盖内置', () => {
    const sprites: SpriteSource = { idle: 'local://a/idle.png' }
    const bodies = buildBodyDescriptors(sprites, null, null)
    const ids = bodies.map((b) => b.id)
    expect(ids).toContain(BUILTIN_BODY_ID)
    expect(ids).toContain(SPRITE_BODY_ID)
    expect(resolveCurrentBodyId(null, 'sprites', bodies)).toBe(SPRITE_BODY_ID)
  })

  it('Live2D/VRM 路径存在才出现对应身体', () => {
    const withL2d = buildBodyDescriptors({}, 'C:/models/moc.model3.json', null)
    expect(withL2d.map((b) => b.id)).toContain(LIVE2D_BODY_ID)
    const withVrm = buildBodyDescriptors({}, null, 'C:/models/v.vrm')
    expect(withVrm.map((b) => b.id)).toContain(VRM_BODY_ID)
    // 路径损坏（指向不存在）不崩——运行时由渲染层 onLoadError → 内置兜底
    expect(() => buildBodyDescriptors({}, 'C:/missing/x.model3.json', null)).not.toThrow()
  })

  it('老用户推导优先级：Live2D > VRM > Sprite > 内置', () => {
    const bodies = buildBodyDescriptors({ idle: 'local://a.png' }, 'C:/m.model3.json', null)
    expect(resolveCurrentBodyId(null, 'live2d', bodies)).toBe(LIVE2D_BODY_ID)
    expect(resolveCurrentBodyId(null, 'sprites', bodies)).toBe(SPRITE_BODY_ID)
  })
})
