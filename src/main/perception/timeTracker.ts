export interface WorkSession {
  startTime: number
  totalActiveMs: number
  stretches: { start: number; end: number }[]
}

let session: WorkSession = {
  startTime: Date.now(),
  totalActiveMs: 0,
  stretches: []
}

let currentStreakStart: number | null = null

export function markActive(): void {
  if (!currentStreakStart) {
    currentStreakStart = Date.now()
  }
}

export function markIdle(): void {
  if (currentStreakStart) {
    const end = Date.now()
    session.stretches.push({ start: currentStreakStart, end })
    session.totalActiveMs += end - currentStreakStart
    currentStreakStart = null
  }
}

export function getSession(): WorkSession {
  const updated = { ...session }
  if (currentStreakStart) {
    updated.totalActiveMs += Date.now() - currentStreakStart
  }
  return updated
}

export function getTotalWorkMinutes(): number {
  return Math.floor(getSession().totalActiveMs / 60000)
}

