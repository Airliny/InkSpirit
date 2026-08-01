import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let isPetMode = true
let dragOrigin = {
  winX: 0, winY: 0,
  startMouseX: 0, startMouseY: 0,
  lastMouseX: 0, lastMouseY: 0,
  velX: 0, velY: 0, lastMoveAt: 0
}
let inertiaTimer: ReturnType<typeof setInterval> | null = null

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 180,
    height: 200,
    x: width - 200,
    y: height - 280,
    title: 'InkSpirit',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true)
  mainWindow.setAlwaysOnTop(true, 'floating')

  // Pet mode: click-through background, only the pet hitbox intercepts
  setPetMode()

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
  mainWindow.setSize(180, 200)
  mainWindow.setResizable(false)
  mainWindow.setHasShadow(false)
  mainWindow.setIgnoreMouseEvents(false)
  if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:mode', 'pet')
}

export function setPanelMode(): void {
  if (!mainWindow) return
  isPetMode = false
  mainWindow.setSize(340, 520)
  mainWindow.setResizable(true)
  mainWindow.setHasShadow(true)
  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.center()
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
  if (!mainWindow || !isPetMode) return
  const [x, y] = mainWindow.getPosition()
  const { width, height } = workAreaFor(mainWindow)
  const newX = Math.max(0, Math.min(width - 200, x + dx))
  const newY = Math.max(0, Math.min(height - 200, y + dy))
  mainWindow.setPosition(Math.round(newX), Math.round(newY))
}

export function moveWindowTo(x: number, y: number): void {
  if (!mainWindow || !isPetMode) return
  const { width, height } = workAreaFor(mainWindow)
  const newX = Math.max(0, Math.min(width - 200, x))
  const newY = Math.max(0, Math.min(height - 200, y))
  mainWindow.setPosition(Math.round(newX), Math.round(newY))
}

/** Work area of the display the window currently sits on (multi-monitor aware) */
function workAreaFor(win: BrowserWindow): { width: number; height: number } {
  const [x, y] = win.getPosition()
  try {
    const display = screen.getDisplayNearestPoint({ x, y })
    return display.workAreaSize
  } catch {
    return screen.getPrimaryDisplay().workAreaSize
  }
}

export function startWindowDrag(): void {
  stopInertia()
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
  const { width, height } = workAreaFor(mainWindow)
  const newX = Math.max(0, Math.min(width - 200, dragOrigin.winX + dx))
  const newY = Math.max(0, Math.min(height - 200, dragOrigin.winY + dy))
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
    const { width, height } = workAreaFor(win)
    let nx = x + vx * STEP_MS
    let ny = y + vy * STEP_MS

    // Bounce off screen edges with energy loss
    if (nx <= 0) { nx = 0; vx = Math.abs(vx) * 0.6 }
    if (nx >= width - 200) { nx = width - 200; vx = -Math.abs(vx) * 0.6 }
    if (ny <= 0) { ny = 0; vy = Math.abs(vy) * 0.6 }
    if (ny >= height - 200) { ny = height - 200; vy = -Math.abs(vy) * 0.6 }

    win.setPosition(Math.round(nx), Math.round(ny))
  }, STEP_MS)
}

function stopInertia(): void {
  if (inertiaTimer) {
    clearInterval(inertiaTimer)
    inertiaTimer = null
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
