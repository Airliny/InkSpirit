import { create } from 'zustand'
import type { AvatarDescriptor } from '../../core/avatar/types'

export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'curious'
  | 'tired'
  | 'love'

interface AvatarState {
  expression: AvatarExpression
  setExpression: (expr: AvatarExpression) => void
  /** 可用身体列表（身体库）——UI 只知道"这是一个身体" */
  bodies: AvatarDescriptor[]
  /** 当前身体（换身体不换灵魂） */
  currentBody: AvatarDescriptor | null
  setBodies: (bodies: AvatarDescriptor[]) => void
  setCurrentBody: (body: AvatarDescriptor | null) => void
}

export const useAvatarStore = create<AvatarState>((set) => ({
  expression: 'neutral',
  setExpression: (expression) => set({ expression }),
  bodies: [],
  currentBody: null,
  setBodies: (bodies) => set({ bodies }),
  setCurrentBody: (currentBody) => set({ currentBody })
}))
