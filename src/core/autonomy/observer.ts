import * as policies from './policies'

export interface EnvironmentSnapshot {
  userIdleMs: number
  activeWindowTitle: string
  isFullscreen: boolean
  currentHour: number
}

export type ObserverCallback = (event: BehaviorSuggestion) => void

export interface BehaviorSuggestion {
  type: 'none' | 'expression_change' | 'chat_message' | 'animation'
  data: Record<string, unknown>
}

let intervalId: ReturnType<typeof setInterval> | null = null
let lastSnapshot: EnvironmentSnapshot | null = null

export function startObserver(
  getSnapshot: () => EnvironmentSnapshot,
  onEvent: ObserverCallback,
  intervalMs: number = 30000
): void {
  if (intervalId) return
  intervalId = setInterval(() => {
    const snapshot = getSnapshot()
    const suggestion = evaluate(snapshot)
    if (suggestion.type !== 'none') {
      onEvent(suggestion)
    }
    lastSnapshot = snapshot
  }, intervalMs)
}

export function stopObserver(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function evaluate(snapshot: EnvironmentSnapshot): BehaviorSuggestion {
  if (policies.isFullscreen(snapshot)) {
    return { type: 'none', data: {} }
  }
  return { type: 'none', data: {} }
}
