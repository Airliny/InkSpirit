import { useEffect, useCallback, useRef } from 'react'
import type { AvatarDescriptor } from '../../core/avatar/types'

declare global {
  interface Window {
    inkAPI: {
      chat: (message: string) => Promise<{ success: boolean; error?: string; budgetBlocked?: boolean; cached?: boolean; route?: string }>
      logEvent: (category: 'startup' | 'renderer' | 'avatar' | 'brain' | 'updater', message: string) => Promise<unknown>
      getDiagnostics: () => Promise<{
        version: string; platform: string; arch: string; electron: string; uptimeSec: number; logsDir: string
        db: { status: string; lastError: string | null }
        soul: { soulId: string | null }
        brain: { provider: string; model: string | null; configured: boolean }
        body: { currentBodyId: string | null; modelType: string }
        gpu: Record<string, string>
        updater: { enabled: boolean }
      }>
      configureProvider: (provider: string, apiKey?: string, model?: string, baseUrl?: string) => Promise<{ success: boolean; error?: string }>
      getAgentState: () => Promise<{
        emotion: Record<string, unknown>
        personality: Record<string, number>
        relationshipStage: string
        history: { role: string; content: string }[]
      }>
      getModelInfo: () => Promise<{ provider: string; model: string; localModel: string | null }>
      getBrainProfile: () => Promise<{
        provider: string; model: string; name: string
        capabilities: { chat: number; code: number; reasoning: number; speed: number }
        contextK: number; temperature: number; endpoint: string; isLocal: boolean
      }>
      setBrainTemperature: (provider: string, temperature: number) =>
        Promise<{ success: boolean; temperature?: number; error?: string }>
      getChatHistory: () => Promise<{ role: string; content: string }[]>
      clearChatHistory: () => Promise<{ success: boolean }>
      getConfig: (key: string) => Promise<string | null>
      setConfig: (key: string, value: string) => Promise<boolean>
      getSecureConfig: (key: string) => Promise<string | null>
      testConnection: (provider: string, apiKey?: string, model?: string, baseUrl?: string) =>
        Promise<{ success: boolean; latencyMs?: number; error?: string }>

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
      getStorageInfo: () => Promise<{ dbMB: number; avatarsMB: number; totalMB: number }>

      // Model
      importModel: (spriteKey: string) => Promise<{ success: boolean; path?: string; error?: string }>
      importModelFromPath: (spriteKey: string, fp: string) => Promise<{ success: boolean; path?: string; error?: string }>
      importLive2DModel: () => Promise<{ success: boolean; path?: string; error?: string }>
      importVrm: () => Promise<{ success: boolean; path?: string; error?: string }>
      getModelSprites: () => Promise<Record<string, string | null>>
      getModelType: () => Promise<string>
      getLive2DPath: () => Promise<string | null>
      hasModel: () => Promise<boolean>
      exportData: () => Promise<{ success: boolean; filePath?: string; error?: string }>
      importData: () => Promise<{ success: boolean; filePath?: string; error?: string }>

      // Avatar Engine — 身体（UI 不知道格式，只知道这是一个身体）
      listBodies: () => Promise<AvatarDescriptor[]>
      getCurrentBodyId: () => Promise<string>
      setCurrentBody: (id: string) => Promise<{ success: boolean; error?: string; body?: AvatarDescriptor }>
      getBodyPrefs: () => Promise<{ lookFollow: boolean; sway: boolean; touchFeel: boolean }>
      setBodyPrefs: (prefs: { lookFollow: boolean; sway: boolean; touchFeel: boolean }) =>
        Promise<{ success: boolean; prefs: { lookFollow: boolean; sway: boolean; touchFeel: boolean } }>
      getTouchQuality: () => Promise<number>
      addInteraction: (kind: 'touch' | 'comfort' | 'respond' | 'spam') => Promise<number>

      // Life Timeline — 成长经历（砚灵日志）
      getLifeEvents: (limit?: number) => Promise<Array<{
        id: string; eventType: string; title: string; detail: string | null; createdAt: number
      }>>
      getTodayLifeEvents: () => Promise<Array<{
        id: string; eventType: string; title: string; detail: string | null; createdAt: number
      }>>
      getSoulManifest: () => Promise<{
        soulId: string; createdAt: number; birthVersion: string; continuityOk: boolean; birthday: string
      }>
      getMoodState: () => Promise<{ valence: number; arousal: number; label: string }>
      onPetMoodState: (callback: (data: { valence: number; arousal: number; label: string }) => void) => () => void
      onPetWorld: (callback: (data: { fatigue: number; hourContext: string; sleepLate: boolean; busyDeviation: number; quietDeviation: number; streakMin: number; userPresent: boolean }) => void) => () => void
      onAvatarCursor: (callback: (data: { x: number; y: number; near: boolean }) => void) => () => void

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

