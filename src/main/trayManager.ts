import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { toggleVisibility, toggleAlwaysOnTop, setPanelMode } from './windowManager'
import { getMainWindow } from './windowManager'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray-icon.png'))
    if (icon.isEmpty()) throw new Error('empty')
  } catch {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4jWNgGAVDHjBCUzYwMDD8Z4ACQ8gP/wMAAAD//wMABvgCEAAAAABJRU5ErkJggg=='
    )
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏伙伴',
      click: () => {
        toggleVisibility()
      }
    },
    {
      label: '切换面板模式',
      click: () => {
        const win = getMainWindow()
        if (win) { win.show(); win.focus() }
        setPanelMode()
        const w = getMainWindow()
        if (w) w.webContents.send('navigate', 'chat')
      }
    },
    {
      label: '置顶窗口',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        const result = toggleAlwaysOnTop()
        menuItem.checked = result
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        const win = getMainWindow()
        if (win) {
          win.show()
          win.focus()
          setPanelMode()
          win.webContents.send('navigate', 'settings')
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出 InkSpirit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('InkSpirit')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    toggleVisibility()
  })
}

export function getTray(): Tray | null {
  return tray
}
