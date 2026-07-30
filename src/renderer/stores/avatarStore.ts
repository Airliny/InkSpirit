import { create } from 'zustand'

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
}

export const useAvatarStore = create<AvatarState>((set) => ({
  expression: 'neutral',
  setExpression: (expression) => set({ expression })
}))
