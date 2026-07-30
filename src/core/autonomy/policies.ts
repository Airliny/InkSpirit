import { EnvironmentSnapshot } from './observer'

export function isFullscreen(snapshot: EnvironmentSnapshot): boolean {
  return snapshot.isFullscreen
}

export function isOffHours(snapshot: EnvironmentSnapshot): boolean {
  const h = snapshot.currentHour
  return h >= 22 || h <= 6
}

export function isWorkHours(snapshot: EnvironmentSnapshot): boolean {
  const h = snapshot.currentHour
  return h >= 9 && h <= 18
}

export function hasBeenIdleTooLong(snapshot: EnvironmentSnapshot, thresholdMs: number = 120000): boolean {
  return snapshot.userIdleMs > thresholdMs
}

export function shouldKeepSilent(snapshot: EnvironmentSnapshot): boolean {
  return snapshot.isFullscreen
}
