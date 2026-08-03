import { logTo } from './logs'

/**
 * Startup trace — every checkpoint appends one line to logs/startup.log so a
 * first-launch failure ("taskbar icon, no window") can be located from the
 * user's machine without a debugger. Never throws.
 *
 * Checkpoints: 01 app ready → 02 database → 03 agent → 04 ipc → 05 window →
 * 06 renderer ready → 07 loaded → 08 load failures.
 * Failures are prefixed [ERROR] so a scan finds them first:
 *
 *   [14:02:04] avatar initialization failed
 *   fallback=builtin
 */
export function writeStartupLog(message: string): void {
  logTo('startup', message)
}

/** Failure marker — a first-launch failure must never be lost in the trace */
export function writeStartupError(message: string): void {
  writeStartupLog(`[ERROR] ${message}`)
}
