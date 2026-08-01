import { contextBridge, ipcRenderer } from 'electron'

const api = {
  chat: (message: string) => ipcRenderer.invoke('agent:chat', message),
  configureProvider: (provider: string, apiKey?: string, model?: string, baseUrl?: string) =>
    ipcRenderer.invoke('agent:configureProvider', provider, apiKey, model, baseUrl),
  getAgentState: () => ipcRenderer.invoke('agent:getState'),
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: string) => ipcRenderer.invoke('config:set', key, value),

  // Window
  setPetMode: () => ipcRenderer.invoke('window:setPetMode'),
  setPanelMode: () => ipcRenderer.invoke('window:setPanelMode'),
  toggleMode: () => ipcRenderer.invoke('window:toggleMode'),
  moveWindowBy: (dx: number, dy: number) => ipcRenderer.invoke('window:moveBy', dx, dy),
  moveWindowTo: (x: number, y: number) => ipcRenderer.invoke('window:moveTo', x, y),
  getWindowPosition: () => ipcRenderer.invoke('window:getPosition') as Promise<[number, number]>,
  startWindowDrag: () => ipcRenderer.invoke('window:startDrag'),
  updateWindowDrag: () => ipcRenderer.invoke('window:updateDrag'),
  endWindowDrag: () => ipcRenderer.invoke('window:endDrag'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),

  // Model
  importModel: (spriteKey: string) => ipcRenderer.invoke('model:import', spriteKey),
  importModelFromPath: (spriteKey: string, fp: string) =>
    ipcRenderer.invoke('model:importFromPath', spriteKey, fp),
  importLive2DModel: () => ipcRenderer.invoke('model:importLive2D'),
  getModelSprites: () => ipcRenderer.invoke('model:getSprites'),
  getModelType: () => ipcRenderer.invoke('model:getType'),
  getLive2DPath: () => ipcRenderer.invoke('model:getLive2DPath'),
  hasModel: () => ipcRenderer.invoke('model:hasModel'),

  // Chat events
  onChatChunk: (cb: (chunk: string) => void) => {
    const h = (_e: Electron.IpcRendererEvent, c: string) => cb(c)
    ipcRenderer.on('agent:chat-chunk', h)
    return () => ipcRenderer.removeListener('agent:chat-chunk', h)
  },
  onChatDone: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('agent:chat-done', h)
    return () => ipcRenderer.removeListener('agent:chat-done', h)
  },

  // Window mode events
  onWindowMode: (cb: (mode: 'pet' | 'panel') => void) => {
    const h = (_e: Electron.IpcRendererEvent, m: 'pet' | 'panel') => cb(m)
    ipcRenderer.on('window:mode', h)
    return () => ipcRenderer.removeListener('window:mode', h)
  },

  // Update
  checkForUpdates: (manual?: boolean) => ipcRenderer.invoke('update:check', !!manual),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb: (data: { state: string; version?: string; message?: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { state: string; version?: string; message?: string }) => cb(d)
    ipcRenderer.on('update:status', h)
    return () => ipcRenderer.removeListener('update:status', h)
  },
  onUpdateProgress: (cb: (data: { percent: number }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { percent: number }) => cb(d)
    ipcRenderer.on('update:progress', h)
    return () => ipcRenderer.removeListener('update:progress', h)
  },

  // Pet behavior events (from autonomy loop)
  onPetBehavior: (cb: (data: { behavior: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { behavior: string }) => cb(d)
    ipcRenderer.on('pet:behavior', h)
    return () => ipcRenderer.removeListener('pet:behavior', h)
  },
  onPetSpeak: (cb: (data: { message: string; action: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { message: string; action: string }) => cb(d)
    ipcRenderer.on('pet:speak', h)
    return () => ipcRenderer.removeListener('pet:speak', h)
  },
  onPetThought: (cb: (data: { thought: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { thought: string }) => cb(d)
    ipcRenderer.on('pet:thought', h)
    return () => ipcRenderer.removeListener('pet:thought', h)
  },
  onPetExpression: (cb: (data: { expression: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { expression: string }) => cb(d)
    ipcRenderer.on('pet:expression', h)
    return () => ipcRenderer.removeListener('pet:expression', h)
  },
  onPetMood: (cb: (data: { mood: string }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { mood: string }) => cb(d)
    ipcRenderer.on('pet:mood', h)
    return () => ipcRenderer.removeListener('pet:mood', h)
  },
  onPetSoul: (cb: (data: { energy: number; attachment: number }) => void) => {
    const h = (_e: Electron.IpcRendererEvent, d: { energy: number; attachment: number }) => cb(d)
    ipcRenderer.on('pet:soul', h)
    return () => ipcRenderer.removeListener('pet:soul', h)
  },
  onPetUserReturned: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('pet:userReturned', h)
    return () => ipcRenderer.removeListener('pet:userReturned', h)
  },
  onNavigate: (cb: (page: string) => void) => {
    const h = (_e: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('navigate', h)
    return () => ipcRenderer.removeListener('navigate', h)
  }
}

contextBridge.exposeInMainWorld('inkAPI', api)
export type InkAPI = typeof api
