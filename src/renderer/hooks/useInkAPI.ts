import { useEffect, useCallback, useRef } from 'react'

declare global {
  interface Window {
    inkAPI: {
      chat: (message: string) => Promise<{ success: boolean; error?: string }>
      configureProvider: (apiKey: string, model?: string) => Promise<{ success: boolean; error?: string }>
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
