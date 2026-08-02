import { logTo } from './logs'

/**
 * Startup trace (kept as a thin wrapper for call-site compatibility):
 * every checkpoint appends one line to logs/startup.log so a first-launch
 * failure ("taskbar icon, no window") can be located from the user's machine
 * without a debugger. Never throws.
 */
export function writeStartupLog(message: string): void {
  logTo('startup', message)
}
