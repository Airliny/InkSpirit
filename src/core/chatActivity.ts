/**
 * Companion Activity — the pet's body state WHILE a conversation is in flight.
 *
 * Not a behavior, not fake thinking: it only reflects the REAL chat pipeline
 * (user sent → AI processing → first token → done). This layer is deliberately
 * separate from the BehaviorDirector — the pet decides proactive speech there;
 * here it merely reacts to the user's own input.
 */

export type CompanionActivity =
  | 'idle'        // no conversation in flight
  | 'listening'   // user just sent a message (short, 300-800ms)
  | 'thinking'    // AI is processing, first token not yet received
  | 'speaking'    // stream is flowing
  | 'afterSpeak'  // brief settling moment after finishing (real people don't freeze)
  | 'error'       // the attempt failed — recover naturally, never stuck

export type ChatActivityEvent =
  | 'user-sent'
  | 'listen-timeout'   // listening duration elapsed → thinking
  | 'first-token'      // stream started
  | 'completed'
  | 'failed'
  | 'thinking-timeout' // no token for too long → stop pretending, back to idle
  | 'after-speak-done'
  | 'error-recovered'

export const LISTENING_MS = 600
export const THINKING_TIMEOUT_MS = 45 * 1000
export const AFTER_SPEAK_MS = 1500
export const ERROR_MS = 2000

/**
 * Pure activity reducer. Returns the next activity; the caller owns timers
 * (fires the matching timeout events). Unknown/invalid transitions keep the
 * current state — the body never jumps to a state the pipeline isn't in.
 */
export function reduceActivity(state: CompanionActivity, event: ChatActivityEvent): CompanionActivity {
  switch (state) {
    case 'idle':
      return event === 'user-sent' ? 'listening' : state

    case 'listening':
      if (event === 'listen-timeout') return 'thinking'
      if (event === 'first-token') return 'speaking'
      if (event === 'failed') return 'error'
      return state

    case 'thinking':
      if (event === 'first-token') return 'speaking'
      if (event === 'failed') return 'error'
      if (event === 'thinking-timeout') return 'idle'
      return state

    case 'speaking':
      if (event === 'completed') return 'afterSpeak'
      if (event === 'failed') return 'error'
      return state

    case 'afterSpeak':
      if (event === 'after-speak-done') return 'idle'
      return state

    case 'error':
      if (event === 'error-recovered') return 'idle'
      return state
  }
}

/** Activities during which the pet should suspend its random autonomous motion */
export function isConversational(state: CompanionActivity): boolean {
  return state !== 'idle'
}
