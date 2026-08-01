import { powerMonitor } from 'electron'
import { getConfig } from '../../core/config'
import { checkGuardian, createGuardianState, type GuardianSettings, type GuardianSignal, type GuardianState } from '../../core/safety/guardian'

let disturbBlocked = false
let state: GuardianState = createGuardianState()

/** Scene awareness: set externally (main process scene watcher) */
export function setGuardianDisturbBlocked(blocked: boolean): void {
  disturbBlocked = blocked
}

function loadSettings(): GuardianSettings {
  return {
    enabled: getConfig('guardian_enabled') !== 'false',
    workThresholdMin: Number(getConfig('guardian_work_threshold_min') || 45),
    cooldownMin: Number(getConfig('guardian_cooldown_min') || 60)
  }
}

/**
 * Poll the guardian (called from the heartbeat). Produces a GuardianSignal —
 * the pet's EXPRESSION of it is decided by the BehaviorDirector, never here.
 */
export function pollGuardian(): GuardianSignal | null {
  const result = checkGuardian(state, {
    idleSec: powerMonitor.getSystemIdleTime(),
    disturbBlocked,
    settings: loadSettings()
  })
  state = result.state
  return result.signal
}

export function getGuardianStatus(): GuardianSettings {
  return loadSettings()
}
