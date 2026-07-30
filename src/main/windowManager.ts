import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let isPetMode = true

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 180,
    height: 200,
    x: width - 200,
    y: height - 280,
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
  mainWindow.setIgnoreMouseEvents(true, { forward: true })
  mainWindow.webContents.send('window:mode', 'pet')
}

export function setPanelMode(): void {
  if (!mainWindow) return
  isPetMode = false
  mainWindow.setSize(340, 520)
  mainWindow.setResizable(true)
  mainWindow.setHasShadow(true)
  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.center()
  mainWindow.webContents.send('window:mode', 'panel')
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
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const newX = Math.max(0, Math.min(width - 200, x + dx))
  const newY = Math.max(0, Math.min(height - 200, y + dy))
  mainWindow.setPosition(newX, newY)
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
