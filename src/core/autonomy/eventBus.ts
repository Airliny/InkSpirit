type EventHandler = (payload: Record<string, unknown>) => void

const listeners: Map<string, Set<EventHandler>> = new Map()

export function emit(event: string, payload: Record<string, unknown> = {}): void {
  const handlers = listeners.get(event)
  if (handlers) {
    for (const handler of handlers) {
      handler(payload)
    }
  }
}

export function on(event: string, handler: EventHandler): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(handler)
  return () => {
    listeners.get(event)?.delete(handler)
  }
}

export function off(event: string, handler: EventHandler): void {
  listeners.get(event)?.delete(handler)
}

export const Events = {
  USER_ACTIVE: 'user:active',
  USER_IDLE: 'user:idle',
  USER_RETURNED: 'user:returned',
  SCREEN_FULLSCREEN: 'screen:fullscreen',
  SCREEN_NORMAL: 'screen:normal',
  WORK_SESSION_LONG: 'work:session_long',
  TIME_LATE_NIGHT: 'time:late_night',
  CONVERSATION_STARTED: 'conversation:started',
  CONVERSATION_ENDED: 'conversation:ended',
  EMOTION_CHANGED: 'emotion:changed',
  RELATIONSHIP_ADVANCED: 'relationship:advanced',
  MEMORY_CONSOLIDATED: 'memory:consolidated'
} as const
