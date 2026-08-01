/**
 * Renderer lifecycle — a small state machine for WebGL context survival.
 * contextlost → suspend (stop rendering); contextrestored → re-init the
 * renderer. The AI/behavior/emotion state and the window position are
 * untouched: only the body reconnects.
 * Pure logic, fully testable.
 */

export type LifecyclePhase = 'idle' | 'running' | 'suspended' | 'disposed'

export interface RendererLifecycleHandlers {
  /** (re)create renderer resources and start rendering */
  init: () => void
  /** stop rendering until the context comes back */
  suspend: () => void
}

export interface RendererLifecycle {
  phase: LifecyclePhase
  handleContextLost: () => void
  handleContextRestored: () => void
  init: () => void
  dispose: () => void
}

export function createRendererLifecycle(handlers: RendererLifecycleHandlers): RendererLifecycle {
  let phase: LifecyclePhase = 'idle'

  return {
    get phase() {
      return phase
    },
    init() {
      if (phase === 'disposed') return
      phase = 'running'
      handlers.init()
    },
    handleContextLost() {
      // Only a running context can be lost; a restored one without a loss is ignored
      if (phase !== 'running') return
      phase = 'suspended'
      handlers.suspend()
    },
    handleContextRestored() {
      if (phase !== 'suspended') return
      phase = 'running'
      handlers.init()
    },
    dispose() {
      phase = 'disposed'
    }
  }
}
