import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import {
  createWindowModeState,
  transitionToPanel,
  transitionToPet,
  clampPosition,
  PET_SIZE,
  PANEL_SIZE,
  type WindowModeState,
  type WorkArea
} from '../core/windowState'
import { getConfig, setConfig } from '../core/config'
import { writeStartupLog, writeStartupError } from './startupLog'

let mainWindow: BrowserWindow | null = null
let isPetMode = true
/**
 * Independent pet/panel positions — the pet always returns "home".
 * 模块加载时绝不碰数据库：导入可能发生在单实例锁 / DB 就绪之前，
 * 损坏的 DB 会让启动在恢复流程开始前就崩溃。真正的位置在
 * createMainWindow（whenReady 内、DB 就绪后）里再读取。
 */
let modeState: WindowModeState = createWindowModeState(null)
let dragOrigin = {
  winX: 0, winY: 0,
  startMouseX: 0, startMouseY: 0,
  lastMouseX: 0, lastMouseY: 0,
  velX: 0, velY: 0, lastMoveAt: 0
}
let inertiaTimer: ReturnType<typeof setInterval> | null = null
let isInertia = false
let hangTimer: ReturnType<typeof setTimeout> | null = null
let isHanging = false
let cursorTimer: ReturnType<typeof setInterval> | null = null

const PET_W = PET_SIZE.width
const PET_H = PET_SIZE.height
/** 视线跟随半径（px）—— 游标进入这个范围才可能被"偷看" */
const CURSOR_LOOK_RADIUS = 320

function loadSavedPetPosition(): { x: number; y: number } | null {
  const raw = getConfig('window_pet_position')
  if (!raw) return null
  const [x, y] = raw.split(',').map(Number)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function persistPetPosition(): void {
  if (modeState.petPosition) {
    setConfig('window_pet_position', `${modeState.petPosition.x},${modeState.petPosition.y}`)
  }
}

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  // DB 已就绪（whenReady 内先 openDatabase 再建窗）—— 恢复上次桌宠位置
  try {
    modeState = createWindowModeState(loadSavedPetPosition())
  } catch {
    // config 不可读（DB 故障）时保持默认位置，绝不阻断建窗
  }

  const initialPos = modeState.petPosition
    ? clampPosition(modeState.petPosition, workAreaAt(modeState.petPosition), PET_SIZE)
    : { x: width - PET_W, y: height - 280 }

  mainWindow = new BrowserWindow({
    width: PET_W,
    height: PET_H,
    x: initialPos.x,
    y: initialPos.y,
    title: 'InkSpirit',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    // Never show a blank transparent window: wait for the first renderer
    // paint, then reveal. If ready-to-show never fires, the startup log
    // shows exactly where the chain died (05 created → missing 06 ready).
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    writeStartupLog('06 renderer ready-to-show — showing window')
    const win = mainWindow
    if (win && !win.isDestroyed()) win.show()
  })

  // 无边框窗口的拖拽区双击会触发最大化（Windows/macOS）——面板/桌宠都不该最大化
  mainWindow.on('maximize', () => {
    const win = mainWindow
    if (win && !win.isDestroyed() && win.isMaximized()) win.unmaximize()
  })
  // Fallback: if the renderer never paints (hung/crashed before first paint),
  // reveal the window anyway so the user is never left with an invisible
  // process. The startup log's missing "06" line pinpoints the failure.
  setTimeout(() => {
    writeStartupLog('06 ready-to-show fallback timer fired')
    const win = mainWindow
    if (win && !win.isDestroyed() && !win.isVisible()) {
      writeStartupError('06 window shown without ready-to-show — renderer never painted')
      win.show()
    }
  }, 5000)

  // 装饰性/几何调用一律 best-effort —— 内容加载（loadURL/loadFile）绝不能被跳过
  try { mainWindow.setVisibleOnAllWorkspaces(true) } catch { /* 个别平台不支持 */ }
  try { mainWindow.setAlwaysOnTop(true, 'floating') } catch { /* no-op */ }

  // Pet mode: click-through background, only the pet hitbox intercepts
  try {
    setPetMode()
  } catch (err) {
    // 几何失败不阻断加载：窗口仍是桌宠尺寸，渲染层兜底仍能显示砚灵
    writeStartupError(`pet mode init failed: ${err instanceof Error ? err.message : err}`)
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function setPetMode(): void {
  if (!mainWindow) return
  isPetMode = true
  // panel → pet: remember the panel spot, return the pet to its own home
  const [x, y] = mainWindow.getPosition()
  const transition = transitionToPet(modeState, { x, y }, workAreaAt({ x, y }))
  modeState = transition.state
  persistPetPosition()
  // 先缩到桌宠尺寸再移动：避免面板以完整尺寸闪现到桌宠位置
  mainWindow.setSize(PET_W, PET_H)
  mainWindow.setResizable(false)
  mainWindow.setHasShadow(false)
  mainWindow.setPosition(transition.position.x, transition.position.y)
  mainWindow.setIgnoreMouseEvents(false)
  if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:mode', 'pet')
  startCursorPush()
}

export function setPanelMode(): void {
  if (!mainWindow) return
  stopCursorPush()
  isPetMode = false
  // pet → panel: remember the pet's home; panel has its own position
  const [x, y] = mainWindow.getPosition()
  const transition = transitionToPanel(modeState, { x, y }, workAreaAt({ x, y }))
  modeState = transition.state
  persistPetPosition()
  if (transition.position) {
    mainWindow.setPosition(transition.position.x, transition.position.y)
  } else {
    mainWindow.center() // first ever panel open
  }

  mainWindow.setSize(PANEL_SIZE.width, PANEL_SIZE.height)
  mainWindow.setResizable(true)
  mainWindow.setHasShadow(true)
  mainWindow.setIgnoreMouseEvents(false)
  if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:mode', 'panel')
}

export function toggleMode(): void {
  if (isPetMode) {
    setPanelMode()
  } else {
    setPetMode()
  }
}

export function moveWindowBy(dx: number, dy: number): void {
  if (!mainWindow || !isPetMode || isHanging || isInertia) return
  const [x, y] = mainWindow.getPosition()
  const wa = workAreaFor(mainWindow)
  const newX = Math.max(wa.x, Math.min(wa.x + wa.width - PET_W, x + dx))
  const newY = Math.max(wa.y, Math.min(wa.y + wa.height - PET_H, y + dy))
  mainWindow.setPosition(Math.round(newX), Math.round(newY))
}

export function moveWindowTo(x: number, y: number): void {
  if (!mainWindow || !isPetMode) return
  const wa = workAreaFor(mainWindow)
  const newX = Math.max(wa.x, Math.min(wa.x + wa.width - PET_W, x))
  const newY = Math.max(wa.y, Math.min(wa.y + wa.height - PET_H, y))
  mainWindow.setPosition(Math.round(newX), Math.round(newY))
}

/** Work area (incl. origin) of the display containing a point (multi-monitor aware) */
function workAreaAt(pos: { x: number; y: number }): WorkArea {
  try {
    const display = screen.getDisplayNearestPoint(pos)
    return display.workArea
  } catch {
    return screen.getPrimaryDisplay().workArea
  }
}

/** Work area of the display the window currently sits on */
function workAreaFor(win: BrowserWindow): WorkArea {
  const [x, y] = win.getPosition()
  return workAreaAt({ x, y })
}

/**
 * Convert a rect in physical pixels (Windows GetWindowRect) to DIPs, the
 * coordinate space Electron's screen/window APIs use. Two-pass: derive the
 * scale factor from the nearest display, convert, then refine.
 */
export function physicalRectToDip(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  let d = screen.getDisplayNearestPoint({ x: cx, y: cy })
  let sx = cx / d.scaleFactor
  let sy = cy / d.scaleFactor
  const refined = screen.getDisplayNearestPoint({ x: sx, y: sy })
  if (refined.id !== d.id) {
    d = refined
    sx = cx / d.scaleFactor
    sy = cy / d.scaleFactor
  }
  return {
    x: rect.x / d.scaleFactor,
    y: rect.y / d.scaleFactor,
    width: rect.width / d.scaleFactor,
    height: rect.height / d.scaleFactor
  }
}

export function startWindowDrag(): void {
  stopInertia()
  cancelHang()
  if (!mainWindow || !isPetMode) return
  const [x, y] = mainWindow.getPosition()
  const cursor = screen.getCursorScreenPoint()
  dragOrigin = {
    winX: x, winY: y,
    startMouseX: cursor.x, startMouseY: cursor.y,
    lastMouseX: cursor.x, lastMouseY: cursor.y,
    velX: 0, velY: 0, lastMoveAt: Date.now()
  }
}

export function updateWindowDrag(): void {
  if (!mainWindow || !isPetMode) return
  const cursor = screen.getCursorScreenPoint()
  const now = Date.now()
  const dtMs = Math.max(16, now - dragOrigin.lastMoveAt)

  // Track pointer velocity so a flick carries momentum after release
  dragOrigin.velX = (cursor.x - dragOrigin.lastMouseX) / dtMs
  dragOrigin.velY = (cursor.y - dragOrigin.lastMouseY) / dtMs
  dragOrigin.lastMouseX = cursor.x
  dragOrigin.lastMouseY = cursor.y
  dragOrigin.lastMoveAt = now

  const dx = cursor.x - dragOrigin.startMouseX
  const dy = cursor.y - dragOrigin.startMouseY
  const wa = workAreaFor(mainWindow)
  const newX = Math.max(wa.x, Math.min(wa.x + wa.width - PET_W, dragOrigin.winX + dx))
  const newY = Math.max(wa.y, Math.min(wa.y + wa.height - PET_H, dragOrigin.winY + dy))
  mainWindow.setPosition(Math.round(newX), Math.round(newY))
}

export function endWindowDrag(): void {
  // Flick release: convert pointer velocity into inertia
  const vx = dragOrigin.velX
  const vy = dragOrigin.velY
  dragOrigin = {
    winX: 0, winY: 0, startMouseX: 0, startMouseY: 0,
    lastMouseX: 0, lastMouseY: 0, velX: 0, velY: 0, lastMoveAt: 0
  }
  startInertia(vx, vy)
}

/** Shimeji-style momentum: keep drifting after a flick, slowing down, bouncing on edges */
function startInertia(vx: number, vy: number): void {
  stopInertia()
  if (Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15) return
  if (!mainWindow || !isPetMode) return
  isInertia = true

  const FRICTION = 0.88
  const STEP_MS = 33

  inertiaTimer = setInterval(() => {
    const win = mainWindow
    if (!win || !isPetMode || win.isDestroyed()) {
      stopInertia()
      return
    }
    vx *= FRICTION
    vy *= FRICTION
    if (Math.abs(vx) < 0.4 && Math.abs(vy) < 0.4) {
      stopInertia()
      return
    }

    const [x, y] = win.getPosition()
    const wa = workAreaFor(win)
    let nx = x + vx * STEP_MS
    let ny = y + vy * STEP_MS

    // Bounce off the display's work-area edges with energy loss
    if (nx <= wa.x) { nx = wa.x; vx = Math.abs(vx) * 0.6 }
    if (nx >= wa.x + wa.width - PET_W) { nx = wa.x + wa.width - PET_W; vx = -Math.abs(vx) * 0.6 }
    if (ny <= wa.y) { ny = wa.y; vy = Math.abs(vy) * 0.6 }
    if (ny >= wa.y + wa.height - PET_H) { ny = wa.y + wa.height - PET_H; vy = -Math.abs(vy) * 0.6 }

    win.setPosition(Math.round(nx), Math.round(ny))
  }, STEP_MS)
}

function stopInertia(): void {
  isInertia = false
  if (inertiaTimer) {
    clearInterval(inertiaTimer)
    inertiaTimer = null
  }
}

/** Shimeji-style: climb onto a target window and cling to its top edge */
export function hangOnWindow(rect: { x: number; y: number; width: number; height: number }): void {
  if (!mainWindow || !isPetMode) return
  stopInertia()
  cancelHang()
  isHanging = true

  // The foreground-window rect comes from Windows in physical pixels, while
  // Electron positions are DIPs — convert so the pet lands where it should
  const dip = physicalRectToDip(rect)
  const display = screen.getDisplayNearestPoint({ x: dip.x + dip.width / 2, y: dip.y + dip.height / 2 })
  const wa = display.workArea
  const x = dip.x + Math.min(Math.max(dip.width / 2 - PET_W / 2, 0), Math.max(dip.width - PET_W, 0))
  // Bottom ~44px of the pet overlaps the window's top edge — looks like clinging
  const y = Math.max(wa.y, dip.y - PET_H + 44)
  mainWindow.setPosition(
    Math.round(Math.max(wa.x, Math.min(wa.x + wa.width - PET_W, x))),
    Math.round(Math.max(wa.y, Math.min(wa.y + wa.height - PET_H, y)))
  )

  // After a while, jump down next to the window (clamped to the work area)
  hangTimer = setTimeout(() => {
    hangTimer = null
    isHanging = false
    if (!mainWindow || !isPetMode || mainWindow.isDestroyed()) return
    const [cx] = mainWindow.getPosition()
    const jy = Math.max(wa.y, Math.min(wa.y + wa.height - PET_H, dip.y + dip.height + 24))
    mainWindow.setPosition(Math.round(Math.max(wa.x, Math.min(wa.x + wa.width - PET_W, cx))), Math.round(jy))
  }, 15000)
}

function cancelHang(): void {
  isHanging = false
  if (hangTimer) {
    clearTimeout(hangTimer)
    hangTimer = null
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function toggleAlwaysOnTop(): boolean {
  if (!mainWindow) return false
  const current = mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(!current, 'floating')
  return !current
}

/**
 * 游标位置推送（桌宠模式，约 5Hz）：渲染层据此实现"偶尔偷看"的视线跟随。
 * 相对桌宠中心偏移（DIP）。电量开销可忽略。
 */
function startCursorPush(): void {
  stopCursorPush()
  if (!mainWindow) return
  cursorTimer = setInterval(() => {
    const win = mainWindow
    if (!win || win.isDestroyed() || win.webContents.isCrashed() || !win.isVisible() || !isPetMode) return
    const cursor = screen.getCursorScreenPoint()
    const [wx, wy] = win.getPosition()
    const rx = cursor.x - (wx + PET_W / 2)
    const ry = cursor.y - (wy + PET_H / 2)
    win.webContents.send('avatar:cursor', {
      x: rx,
      y: ry,
      near: Math.abs(rx) < CURSOR_LOOK_RADIUS && Math.abs(ry) < CURSOR_LOOK_RADIUS
    })
  }, 200)
}

function stopCursorPush(): void {
  if (cursorTimer) {
    clearInterval(cursorTimer)
    cursorTimer = null
  }
}

export function toggleVisibility(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

export function isInPetMode(): boolean {
  return isPetMode
}
