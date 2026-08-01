import { useEffect, useCallback, useRef } from 'react'

declare global {
  interface Window {
    inkAPI: {
      chat: (message: string) => Promise<{ success: boolean; error?: string; budgetBlocked?: boolean; cached?: boolean; route?: string }>
      configureProvider: (provider: string, apiKey?: string, model?: string, baseUrl?: string) => Promise<{ success: boolean; error?: string }>
      getAgentState: () => Promise<{
        emotion: Record<string, unknown>
        personality: Record<string, number>
        relationshipStage: string
        history: { role: string; content: string }[]
      }>
      getModelInfo: () => Promise<{ provider: string; model: string; localModel: string | null }>
      getChatHistory: () => Promise<{ role: string; content: string }[]>
      clearChatHistory: () => Promise<{ success: boolean }>
      getConfig: (key: string) => Promise<string | null>
      setConfig: (key: string, value: string) => Promise<boolean>
      getSecureConfig: (key: string) => Promise<string | null>

      // Window
      setPetMode: () => Promise<void>
      setPanelMode: () => Promise<void>
      toggleMode: () => Promise<void>
      moveWindowBy: (dx: number, dy: number) => Promise<void>
      moveWindowTo: (x: number, y: number) => Promise<void>
      getWindowPosition: () => Promise<[number, number]>
      startWindowDrag: () => Promise<void>
      updateWindowDrag: () => Promise<void>
      endWindowDrag: () => Promise<void>
      minimizeWindow: () => void
      toggleAlwaysOnTop: () => Promise<boolean>
      setAutoLaunch: (enabled: boolean) => Promise<boolean>
      getAutoLaunch: () => Promise<boolean>
      showPetMenu: () => Promise<void>

      // Model
      importModel: (spriteKey: string) => Promise<{ success: boolean; path?: string; error?: string }>
      importModelFromPath: (spriteKey: string, fp: string) => Promise<{ success: boolean; path?: string; error?: string }>
      importLive2DModel: () => Promise<{ success: boolean; path?: string; error?: string }>
      getModelSprites: () => Promise<Record<string, string | null>>
      getModelType: () => Promise<string>
      getLive2DPath: () => Promise<string | null>
      hasModel: () => Promise<boolean>
      exportData: () => Promise<{ success: boolean; filePath?: string; error?: string }>
      importData: () => Promise<{ success: boolean; filePath?: string; error?: string }>

      // Chat events
      onChatChunk: (callback: (chunk: string) => void) => () => void
      onChatDone: (callback: () => void) => () => void
      onWindowMode: (callback: (mode: 'pet' | 'panel') => void) => () => void
      onNavigate: (callback: (page: string) => void) => () => void
      onPetBehavior: (callback: (data: { behavior: string }) => void) => () => void
      onPetSpeak: (callback: (data: { message: string; action: string }) => void) => () => void
      onPetThought: (callback: (data: { thought: string }) => void) => () => void
      onPetExpression: (callback: (data: { expression: string }) => void) => () => void
      onPetMood: (callback: (data: { mood: string }) => void) => () => void
      onPetSoul: (callback: (data: { energy: number; attachment: number }) => void) => () => void
      onPetUserReturned: (callback: () => void) => () => void

      // Local models (Ollama)
      getOllamaStatus: () => Promise<{ running: boolean; version?: string; error?: string }>
      listLocalModels: () => Promise<Array<{ name: string; size: number }>>
      searchModelCatalog: () => Promise<{
        models: Array<{
          tag: string; name: string; size: string; parameterSize: string; description: string
          minVramGB: number; minRamGB: number
          installed: boolean; feasible: boolean; reason: string; recommended: boolean
        }>
        hardware: { totalRamGB: number; vramGB: number | null; gpuName: string }
      }>
      getModelHardware: () => Promise<{ totalRamGB: number; vramGB: number | null; gpuName: string }>
      pullLocalModel: (model: string) => Promise<{ success: boolean; error?: string }>
      removeLocalModel: (model: string) => Promise<{ success: boolean; error?: string }>
      useLocalModel: (model: string) => Promise<{ success: boolean; model: string }>
      onModelPullProgress: (callback: (data: { model: string; percent: number; status: string }) => void) => () => void

      // Update
      checkForUpdates: (manual?: boolean) => Promise<{ state: string; version?: string; message?: string }>
      downloadUpdate: () => Promise<boolean>
      installUpdate: () => Promise<boolean>
      onUpdateStatus: (callback: (data: { state: string; version?: string; message?: string }) => void) => () => void
      onUpdateProgress: (callback: (data: { percent: number }) => void) => () => void

      // Cost control
      getCostSummary: () => Promise<{
        month: string
        entries: Record<string, { promptTokens: number; completionTokens: number; requests: number; costUsd: number }>
        totalTokens: number
        totalCostUsd: number
        budgetUsd: number
        budgetExceeded: boolean
      }>
      setCostBudget: (usd: number) => Promise<unknown>
      setRouterEnabled: (enabled: boolean) => Promise<{ enabled: boolean; localModel: string | null; localAvailable: boolean }>
      getRouterSettings: () => Promise<{ enabled: boolean; localModel: string | null; localAvailable: boolean }>
      clearResponseCache: () => Promise<number>
      getCacheSize: () => Promise<number>
    }
  }
}

export function useInkAPI() {
  const chat = useCallback(async (message: string) => {
    return window.inkAPI.chat(message)
  }, [])

  const getConfig = useCallback(async (key: string) => {
    return window.inkAPI.getConfig(key)
  }, [])

  const setConfig = useCallback(async (key: string, value: string) => {
    return window.inkAPI.setConfig(key, value)
  }, [])

  const minimizeWindow = useCallback(() => {
    window.inkAPI.minimizeWindow()
  }, [])

  return { chat, getConfig, setConfig, minimizeWindow }
}
