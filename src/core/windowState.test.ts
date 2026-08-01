import { describe, it, expect } from 'vitest'
import {
  createWindowModeState,
  transitionToPanel,
  transitionToPet,
  clampPosition,
  PET_SIZE
} from './windowState'

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1080 }
const CORNER = { x: 1920 - PET_SIZE.width, y: 1080 - PET_SIZE.height - 80 }

describe('H1 — pet→panel→pet 位置连续性', () => {
  it('桌宠在右下角，打开聊天再关闭，仍回右下角', () => {
    let state = createWindowModeState(CORNER)
    // pet → panel
    const toPanel = transitionToPanel(state, CORNER, WORK_AREA)
    state = toPanel.state
    expect(toPanel.position).toBeNull() // 首次打开 → 调用方 center
    // panel → pet（面板可能在任意位置）
    const toPet = transitionToPet(state, { x: 500, y: 300 }, WORK_AREA)
    state = toPet.state
    expect(toPet.position).toEqual(CORNER)
    // 再开再关，依然右下角
    const again = transitionToPanel(state, toPet.position, WORK_AREA)
    const againPet = transitionToPet(again.state, { x: 700, y: 400 }, WORK_AREA)
    expect(againPet.position).toEqual(CORNER)
  })

  it('panel 位置独立记忆（第二次打开回上次面板位置）', () => {
    let state = createWindowModeState(CORNER)
    const p1 = transitionToPanel(state, CORNER, WORK_AREA)
    state = p1.state // panelPosition 仍 null
    const back = transitionToPet(state, { x: 400, y: 200 }, WORK_AREA)
    state = back.state // panelPosition = {400,200}
    const p2 = transitionToPanel(state, back.position, WORK_AREA)
    expect(p2.position).toEqual({ x: 400, y: 200 })
  })
})

describe('H1 — 多显示器/重启恢复', () => {
  const SECOND = { x: 1920, y: 0, width: 1920, height: 1080 }
  const secondPos = { x: 1920 + 800, y: 600 }

  it('桌宠在副屏，切换后仍回副屏（按所在显示器 workArea）', () => {
    let state = createWindowModeState(secondPos)
    const toPanel = transitionToPanel(state, secondPos, SECOND)
    state = toPanel.state
    const toPet = transitionToPet(state, { x: 2000, y: 100 }, SECOND)
    expect(toPet.position).toEqual(secondPos)
  })

  it('重启恢复：从持久化的 petPosition 重建状态，切换仍回原位置', () => {
    // 模拟重启：createWindowModeState(loadSavedPetPosition())
    // 宠物住在副屏 → 以副屏 workArea 收敛
    const state = createWindowModeState(secondPos)
    const toPet = transitionToPet(
      { ...state, panelPosition: null },
      { x: 100, y: 100 },
      SECOND
    )
    expect(toPet.position).toEqual(secondPos)
  })

  it('显示器被拔：位置 clamp 到主屏 workArea，不悬空', () => {
    const offScreen = { x: 4000, y: 3000 }
    const clamped = clampPosition(offScreen, WORK_AREA, PET_SIZE)
    expect(clamped.x).toBeLessThan(WORK_AREA.width)
    expect(clamped.y).toBeLessThan(WORK_AREA.height)
  })
})

describe('H1 — clampPosition', () => {
  it('边界收敛', () => {
    expect(clampPosition({ x: -50, y: -20 }, WORK_AREA, PET_SIZE)).toEqual({ x: 0, y: 0 })
    expect(clampPosition({ x: 9999, y: 9999 }, WORK_AREA, PET_SIZE)).toEqual({
      x: 1920 - PET_SIZE.width,
      y: 1080 - PET_SIZE.height
    })
  })
})
