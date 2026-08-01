/**
 * Window mode state — pet mode and panel mode keep INDEPENDENT positions.
 * Switching modes must never move the pet from "where it lives".
 * Pure logic: no electron, fully testable (incl. multi-monitor via workArea).
 */

export interface Pos {
  x: number
  y: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export const PET_SIZE: Size = { width: 180, height: 200 }
export const PANEL_SIZE: Size = { width: 340, height: 520 }

export interface WindowModeState {
  /** where the pet lives (persisted across restarts) */
  petPosition: Pos | null
  /** where the panel was last left */
  panelPosition: Pos | null
}

export function createWindowModeState(
  petPosition: Pos | null = null,
  panelPosition: Pos | null = null
): WindowModeState {
  return { petPosition, panelPosition }
}

/** Keep a position inside a display's work area (handles unplugged monitors) */
export function clampPosition(pos: Pos, workArea: WorkArea, size: Size): Pos {
  return {
    x: Math.round(Math.max(workArea.x, Math.min(workArea.x + workArea.width - size.width, pos.x))),
    y: Math.round(Math.max(workArea.y, Math.min(workArea.y + workArea.height - size.height, pos.y)))
  }
}

/**
 * pet → panel: remember the pet's spot; panel goes to its own saved spot
 * (or null → caller centers on first open).
 */
export function transitionToPanel(
  state: WindowModeState,
  currentPos: Pos,
  workArea: WorkArea
): { state: WindowModeState; position: Pos | null } {
  const next: WindowModeState = {
    petPosition: clampPosition(currentPos, workArea, PET_SIZE),
    panelPosition: state.panelPosition
  }
  return {
    state: next,
    position: state.panelPosition ? clampPosition(state.panelPosition, workArea, PANEL_SIZE) : null
  }
}

/**
 * panel → pet: remember the panel's spot; the pet returns exactly to where
 * it lived (falls back to the current spot on first ever transition).
 */
export function transitionToPet(
  state: WindowModeState,
  currentPos: Pos,
  workArea: WorkArea
): { state: WindowModeState; position: Pos } {
  const next: WindowModeState = {
    petPosition: state.petPosition,
    panelPosition: clampPosition(currentPos, workArea, PANEL_SIZE)
  }
  const target = state.petPosition ?? currentPos
  return {
    state: next,
    position: clampPosition(target, workArea, PET_SIZE)
  }
}
