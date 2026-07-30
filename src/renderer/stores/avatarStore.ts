import { create } from 'zustand'
import type { Expression } from '../components/Avatar'

interface AvatarState {
  expression: Expression
  setExpression: (expr: Expression) => void
}

export const useAvatarStore = create<AvatarState>((set) => ({
  expression: 'neutral',
  setExpression: (expression) => set({ expression })
}))
