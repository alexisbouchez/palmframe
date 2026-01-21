"use client"

import { create } from "zustand"
import type { Thread, ModelConfig, Provider } from "@/types"

interface AppState {
  // Threads
  threads: Thread[]
  currentThreadId: string | null

  // Models and Providers (global, not per-thread)
  models: ModelConfig[]
  providers: Provider[]

  // Right panel state (UI state, not thread data)
  rightPanelTab: "todos" | "files" | "subagents"

  // Settings dialog state
  settingsOpen: boolean

  // Sidebar state
  sidebarCollapsed: boolean

  // Thread actions
  loadThreads: () => Promise<void>
  createThread: (metadata?: Record<string, unknown>) => Promise<Thread>
  selectThread: (threadId: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<void>
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>
  generateTitleForFirstMessage: (threadId: string, content: string) => Promise<void>

  // Model actions
  loadModels: () => Promise<void>
  loadProviders: () => Promise<void>
  setApiKey: (providerId: string, apiKey: string) => Promise<void>
  deleteApiKey: (providerId: string) => Promise<void>

  // Panel actions
  setRightPanelTab: (tab: "todos" | "files" | "subagents") => void

  // Settings actions
  setSettingsOpen: (open: boolean) => void

  // Sidebar actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  threads: [],
  currentThreadId: null,
  models: [],
  providers: [],
  rightPanelTab: "todos",
  settingsOpen: false,
  sidebarCollapsed: false,

  // Thread actions
  loadThreads: async () => {
    try {
      const response = await fetch("/api/threads")
      if (!response.ok) throw new Error("Failed to load threads")
      const threads = await response.json()
      set({ threads })

      // Select first thread if none selected
      if (!get().currentThreadId && threads.length > 0) {
        await get().selectThread(threads[0].thread_id)
      }
    } catch (error) {
      console.error("[Store] Failed to load threads:", error)
    }
  },

  createThread: async (metadata?: Record<string, unknown>) => {
    const response = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata })
    })
    if (!response.ok) throw new Error("Failed to create thread")
    const thread = await response.json()
    set((state) => ({
      threads: [thread, ...state.threads],
      currentThreadId: thread.thread_id
    }))
    return thread
  },

  selectThread: async (threadId: string) => {
    set({ currentThreadId: threadId })
  },

  deleteThread: async (threadId: string) => {
    console.log("[Store] Deleting thread:", threadId)
    try {
      const response = await fetch(`/api/threads/${threadId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete thread")

      set((state) => {
        const threads = state.threads.filter((t) => t.thread_id !== threadId)
        const wasCurrentThread = state.currentThreadId === threadId
        const newCurrentId = wasCurrentThread ? threads[0]?.thread_id || null : state.currentThreadId

        return { threads, currentThreadId: newCurrentId }
      })
    } catch (error) {
      console.error("[Store] Failed to delete thread:", error)
    }
  },

  updateThread: async (threadId: string, updates: Partial<Thread>) => {
    const response = await fetch(`/api/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error("Failed to update thread")
    const updated = await response.json()
    set((state) => ({
      threads: state.threads.map((t) => (t.thread_id === threadId ? updated : t))
    }))
  },

  generateTitleForFirstMessage: async (threadId: string, content: string) => {
    try {
      const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content })
      })
      if (!response.ok) throw new Error("Failed to generate title")
      const { title } = await response.json()
      await get().updateThread(threadId, { title })
    } catch (error) {
      console.error("[Store] Failed to generate title:", error)
    }
  },

  // Model actions
  loadModels: async () => {
    try {
      const response = await fetch("/api/models")
      if (!response.ok) throw new Error("Failed to load models")
      const models = await response.json()
      set({ models })
    } catch (error) {
      console.error("[Store] Failed to load models:", error)
    }
  },

  loadProviders: async () => {
    try {
      const response = await fetch("/api/models/providers")
      if (!response.ok) throw new Error("Failed to load providers")
      const providers = await response.json()
      set({ providers })
    } catch (error) {
      console.error("[Store] Failed to load providers:", error)
    }
  },

  setApiKey: async (providerId: string, apiKey: string) => {
    console.log("[Store] setApiKey called:", { providerId, keyLength: apiKey.length })
    try {
      const response = await fetch("/api/models/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey })
      })
      if (!response.ok) throw new Error("Failed to set API key")
      // Reload providers and models to update availability
      await get().loadProviders()
      await get().loadModels()
    } catch (e) {
      console.error("[Store] Failed to set API key:", e)
      throw e
    }
  },

  deleteApiKey: async (providerId: string) => {
    const response = await fetch("/api/models/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId })
    })
    if (!response.ok) throw new Error("Failed to delete API key")
    await get().loadProviders()
    await get().loadModels()
  },

  // Panel actions
  setRightPanelTab: (tab: "todos" | "files" | "subagents") => {
    set({ rightPanelTab: tab })
  },

  // Settings actions
  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open })
  },

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  }
}))
