import { useEffect, useCallback, useRef } from 'react'

declare global {
  interface Window {
    inkAPI: {
      chat: (message: string) => Promise<{ success: boolean; error?: string }>
      configureProvider: (provider: string, apiKey?: string, model?: string, baseUrl?: string) => Promise<{ success: boolean; error?: string }>
      getAgentState: () => Promise<{
        emotion: Record<string, unknown>
        personality: Record<string, number>
        relationshipStage: string
        history: { role: string; content: string }[]
      }>
      getConfig: (key: string) => Promise<string | null>
      setConfig: (key: string, value: string) => Promise<boolean>
      minimizeWindow: () => void
      toggleAlwaysOnTop: () => Promise<boolean>
      onChatChunk: (callback: (chunk: string) => void) => () => void
      onChatDone: (callback: () => void) => () => void
      onNavigate: (callback: (page: string) => void) => () => void
      onPetExpression: (callback: (data: { expression: string }) => void) => () => void
      onPetMood: (callback: (data: { mood: string }) => void) => () => void
      onPetSoul: (callback: (data: { energy: number; attachment: number }) => void) => () => void
      onPetBehavior: (callback: (data: { behavior: string }) => void) => () => void
      onPetSpeak: (callback: (data: { message: string; action: string }) => void) => () => void
      onPetThought: (callback: (data: { thought: string }) => void) => () => void
      checkForUpdates: (manual?: boolean) => Promise<{ state: string; version?: string; message?: string }>
      downloadUpdate: () => Promise<boolean>
      installUpdate: () => Promise<boolean>
      onUpdateStatus: (callback: (data: { state: string; version?: string; message?: string }) => void) => () => void
      onUpdateProgress: (callback: (data: { percent: number }) => void) => () => void
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
