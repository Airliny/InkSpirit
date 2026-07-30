import { create } from 'zustand'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  addUserMessage: (content: string) => void
  appendAssistantChunk: (chunk: string) => void
  finishAssistantMessage: () => void
  clearChat: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { role: 'user', content }],
      isStreaming: true
    })),

  appendAssistantChunk: (chunk) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      } else {
        msgs.push({ role: 'assistant', content: chunk })
      }
      return { messages: msgs }
    }),

  finishAssistantMessage: () =>
    set({ isStreaming: false }),

  clearChat: () =>
    set({ messages: [], isStreaming: false })
}))
