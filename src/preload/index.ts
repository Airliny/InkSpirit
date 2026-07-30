import { contextBridge, ipcRenderer } from 'electron'

const api = {
  chat: (message: string) => ipcRenderer.invoke('agent:chat', message),

  configureProvider: (apiKey: string, model?: string) =>
    ipcRenderer.invoke('agent:configureProvider', apiKey, model),

  getAgentState: () => ipcRenderer.invoke('agent:getState'),

  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),

  setConfig: (key: string, value: string) =>
    ipcRenderer.invoke('config:set', key, value),

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),

  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),

  onChatChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) =>
      callback(chunk)
    ipcRenderer.on('agent:chat-chunk', handler)
    return () => ipcRenderer.removeListener('agent:chat-chunk', handler)
  },

  onChatDone: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('agent:chat-done', handler)
    return () => ipcRenderer.removeListener('agent:chat-done', handler)
  },

  onNavigate: (callback: (page: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, page: string) =>
      callback(page)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  }
}

contextBridge.exposeInMainWorld('inkAPI', api)

export type InkAPI = typeof api
