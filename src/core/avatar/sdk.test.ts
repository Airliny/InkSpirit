import { describe, it, expect } from 'vitest'
import { validateAvatarDescriptor, FROZEN_AVATAR_TYPES, assertSdkValid } from './sdk'
import { buildBodyDescriptors, SPRITE_CAPABILITIES } from './bodies'
import type { AvatarDescriptor } from './types'

describe('Avatar SDK — 身体契约冻结', () => {
  it('格式冻结：只有 builtin/sprite/live2d/vrm（Spine/MMD/FBX 不入）', () => {
    expect(FROZEN_AVATAR_TYPES).toEqual(['builtin', 'sprite', 'live2d', 'vrm'])
  })

  it('合法描述符通过校验', () => {
    const body = buildBodyDescriptors({ idle: 'x.png' }, null, null)[1]
    const v = validateAvatarDescriptor(body)
    expect(v.ok).toBe(true)
    expect(v.errors).toEqual([])
  })

  it('未冻结格式被拒绝', () => {
    const v = validateAvatarDescriptor({
      id: 'x', name: 'X', type: 'spine',
      capabilities: SPRITE_CAPABILITIES,
      source: { kind: 'spines', path: 'x' }
    })
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('未冻结'))).toBe(true)
  })

  it('capability 白名单：自定义键被拒绝', () => {
    const body = buildBodyDescriptors({ idle: 'x.png' }, null, null)[1]
    const v = validateAvatarDescriptor({ ...body, capabilities: { ...body.capabilities, psychic: true } })
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('未注册键'))).toBe(true)
  })

  it('非布尔 capability 被拒绝', () => {
    const body = buildBodyDescriptors({ idle: 'x.png' }, null, null)[1]
    const v = validateAvatarDescriptor({ ...body, capabilities: { ...body.capabilities, tail: 'long' } })
    expect(v.ok).toBe(false)
  })

  it('缺 id/name/source → 拒绝', () => {
    expect(validateAvatarDescriptor({}).ok).toBe(false)
    expect(validateAvatarDescriptor(null).ok).toBe(false)
  })

  it('assertSdkValid：非法描述符直接抛错（主进程自检）', () => {
    const body = buildBodyDescriptors({ idle: 'x.png' }, null, null)[1]
    expect(() => assertSdkValid(body)).not.toThrow()
    expect(() => assertSdkValid({ ...body, type: 'mmd' as AvatarDescriptor['type'] })).toThrow()
  })

  it('所有内置身体都通过 SDK 校验（含 3D 身体）', () => {
    const bodies = buildBodyDescriptors({ idle: 'x.png' }, '/m.json', '/b.vrm')
    for (const b of bodies) {
      expect(validateAvatarDescriptor(b).ok).toBe(true)
    }
  })
})
