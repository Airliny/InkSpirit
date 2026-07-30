let lastActivity = Date.now()
let idleTimers: ReturnType<typeof setTimeout>[] = []

export interface ActivityState {
  isIdle: boolean
  idleDurationMs: number
  activeDurationMs: number
}

export function startActivityMonitor(
  onActive: () => void,
  onIdle: (durationMs: number) => void,
  idleThresholdMs: number = 60000
): () => void {
  lastActivity = Date.now()

  const handleActivity = () => {
    const wasIdle = Date.now() - lastActivity > idleThresholdMs
    lastActivity = Date.now()
    if (wasIdle) onActive()
    resetIdleTimer()
  }

  const checkIdle = () => {
    const elapsed = Date.now() - lastActivity
    if (elapsed >= idleThresholdMs) {
      onIdle(elapsed)
    }
  }

  const idleInterval = setInterval(checkIdle, idleThresholdMs / 2)

  return () => {
    clearInterval(idleInterval)
    idleTimers.forEach(clearTimeout)
    idleTimers = []
  }
}

function resetIdleTimer() {
  idleTimers.forEach(clearTimeout)
  idleTimers = []
}

export function getActivityState(idleThresholdMs: number = 60000): ActivityState {
  const elapsed = Date.now() - lastActivity
  return {
    isIdle: elapsed >= idleThresholdMs,
    idleDurationMs: Math.max(0, elapsed),
    activeDurationMs: elapsed
  }
}
