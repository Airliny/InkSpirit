import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { toggleVisibility, toggleAlwaysOnTop } from './windowManager'
import { getMainWindow } from './windowManager'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏伙伴',
      click: () => {
        toggleVisibility()
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
