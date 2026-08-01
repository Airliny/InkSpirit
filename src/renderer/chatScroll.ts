/**
 * Chat scroll resume — "back to the conversation" must feel like微信/Discord:
 * following the latest message when you were near the bottom, keeping your
 * position when you were reading history. Pure logic, fully testable.
 */

export interface ChatScrollState {
  scrollTop: number
  /** pixels between viewport bottom and content bottom */
  distanceFromBottom: number
  /** user was following the latest messages when leaving */
  wasFollowingLatest: boolean
}

/** Below this distance we treat the user as following the latest message */
export const FOLLOW_THRESHOLD_PX = 80

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export function captureScroll(el: ScrollMetrics): ChatScrollState {
  const distanceFromBottom = Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight)
  return {
    scrollTop: el.scrollTop,
    distanceFromBottom,
    wasFollowingLatest: distanceFromBottom < FOLLOW_THRESHOLD_PX
  }
}

/** Streaming follow: only auto-scroll when already near the bottom */
export function isNearBottom(el: ScrollMetrics): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX
}

/** Apply a saved state: bottom when following, exact position otherwise */
export function restoreScroll(el: ScrollMetrics & { scrollTop: number }, state: ChatScrollState): void {
  el.scrollTop = state.wasFollowingLatest ? el.scrollHeight : Math.min(state.scrollTop, el.scrollHeight)
}

// ---- Module-level persistence across ChatView mounts ----

let savedState: ChatScrollState | null = null

export function saveChatScroll(state: ChatScrollState | null): void {
  savedState = state
}

export function getSavedChatScroll(): ChatScrollState | null {
  return savedState
}
