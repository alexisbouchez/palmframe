"use client"

/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  useSyncExternalStore,
  type ReactNode
} from "react"
import { useStream } from "@langchain/langgraph-sdk/react"
import { APITransport } from "./api-transport"
import type { Message, Todo, FileInfo, Subagent, HITLRequest } from "@/types"

// Open file tab type
export interface OpenFile {
  path: string
  name: string
}

// Token usage tracking for context window monitoring
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  lastUpdated: Date
}

// Per-thread state (persisted/restored from checkpoints)
export interface ThreadState {
  messages: Message[]
  todos: Todo[]
  workspaceFiles: FileInfo[]
  workspacePath: string | null
  daytonaSandboxId: string | null
  e2bSandboxId: string | null
  subagents: Subagent[]
  pendingApproval: HITLRequest | null
  error: string | null
  currentModel: string
  openFiles: OpenFile[]
  activeTab: "agent" | string
  fileContents: Record<string, string>
  tokenUsage: TokenUsage | null
}

// Stream instance type - using any since we don't have DeepAgent type in web
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamInstance = ReturnType<typeof useStream<any>>

// Stream data that we want to be reactive
interface StreamData {
  messages: StreamInstance["messages"]
  isLoading: boolean
  stream: StreamInstance | null
}

// Actions available on a thread
export interface ThreadActions {
  appendMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  setTodos: (todos: Todo[]) => void
  setWorkspaceFiles: (files: FileInfo[] | ((prev: FileInfo[]) => FileInfo[])) => void
  setWorkspacePath: (path: string | null) => void
  setDaytonaSandboxId: (sandboxId: string | null) => void
  setE2bSandboxId: (sandboxId: string | null) => void
  setSubagents: (subagents: Subagent[]) => void
  setPendingApproval: (request: HITLRequest | null) => void
  setError: (error: string | null) => void
  clearError: () => void
  setCurrentModel: (modelId: string) => void
  openFile: (path: string, name: string) => void
  closeFile: (path: string) => void
  setActiveTab: (tab: "agent" | string) => void
  setFileContents: (path: string, content: string) => void
}

// Context value
interface ThreadContextValue {
  getThreadState: (threadId: string) => ThreadState
  getThreadActions: (threadId: string) => ThreadActions
  initializeThread: (threadId: string) => void
  cleanupThread: (threadId: string) => void
  subscribeToStream: (threadId: string, callback: () => void) => () => void
  getStreamData: (threadId: string) => StreamData
}

// Default thread state
const createDefaultThreadState = (): ThreadState => ({
  messages: [],
  todos: [],
  workspaceFiles: [],
  workspacePath: null,
  daytonaSandboxId: null,
  e2bSandboxId: null,
  subagents: [],
  pendingApproval: null,
  error: null,
  currentModel: "claude-sonnet-4-5-20250929",
  openFiles: [],
  activeTab: "agent",
  fileContents: {},
  tokenUsage: null
})

const defaultStreamData: StreamData = {
  messages: [],
  isLoading: false,
  stream: null
}

const ThreadContext = createContext<ThreadContextValue | null>(null)

// Custom event types from the stream
interface CustomEventData {
  type?: string
  request?: HITLRequest
  files?: Array<{ path: string; is_dir?: boolean; size?: number }>
  path?: string
  subagents?: Array<{
    id?: string
    name?: string
    description?: string
    status?: string
    startedAt?: Date
    completedAt?: Date
  }>
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  }
}

// Component that holds a stream and notifies subscribers
function ThreadStreamHolder({
  threadId,
  onStreamUpdate,
  onCustomEvent,
  onError
}: {
  threadId: string
  onStreamUpdate: (data: StreamData) => void
  onCustomEvent: (data: CustomEventData) => void
  onError: (error: Error) => void
}): null {
  const transport = useMemo(() => new APITransport(), [])

  const onCustomEventRef = useRef(onCustomEvent)
  useEffect(() => {
    onCustomEventRef.current = onCustomEvent
  })

  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = useStream<any>({
    transport,
    threadId,
    messagesKey: "messages",
    onCustomEvent: (data) => {
      onCustomEventRef.current(data as CustomEventData)
    },
    onError: (error: unknown) => {
      onErrorRef.current(error instanceof Error ? error : new Error(String(error)))
    }
  })

  const onStreamUpdateRef = useRef(onStreamUpdate)
  useEffect(() => {
    onStreamUpdateRef.current = onStreamUpdate
  })

  const prevMessagesRef = useRef(stream.messages)
  const prevIsLoadingRef = useRef(stream.isLoading)

  useEffect(() => {
    const messagesChanged = prevMessagesRef.current !== stream.messages
    const loadingChanged = prevIsLoadingRef.current !== stream.isLoading

    if (messagesChanged || loadingChanged || !prevMessagesRef.current) {
      prevMessagesRef.current = stream.messages
      prevIsLoadingRef.current = stream.isLoading

      onStreamUpdateRef.current({
        messages: stream.messages,
        isLoading: stream.isLoading,
        stream
      })
    }
  })

  useEffect(() => {
    onStreamUpdateRef.current({
      messages: stream.messages,
      isLoading: stream.isLoading,
      stream
    })
  }, [stream])

  return null
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [threadStates, setThreadStates] = useState<Record<string, ThreadState>>({})
  const [activeThreadIds, setActiveThreadIds] = useState<Set<string>>(new Set())
  const initializedThreadsRef = useRef<Set<string>>(new Set())
  const actionsCache = useRef<Record<string, ThreadActions>>({})

  const streamDataRef = useRef<Record<string, StreamData>>({})
  const streamSubscribersRef = useRef<Record<string, Set<() => void>>>({})

  const notifyStreamSubscribers = useCallback((threadId: string) => {
    const subscribers = streamSubscribersRef.current[threadId]
    if (subscribers) {
      subscribers.forEach((callback) => callback())
    }
  }, [])

  const handleStreamUpdate = useCallback(
    (threadId: string, data: StreamData) => {
      streamDataRef.current[threadId] = data
      notifyStreamSubscribers(threadId)
    },
    [notifyStreamSubscribers]
  )

  const subscribeToStream = useCallback((threadId: string, callback: () => void) => {
    if (!streamSubscribersRef.current[threadId]) {
      streamSubscribersRef.current[threadId] = new Set()
    }
    streamSubscribersRef.current[threadId].add(callback)

    return () => {
      streamSubscribersRef.current[threadId]?.delete(callback)
    }
  }, [])

  const getStreamData = useCallback((threadId: string): StreamData => {
    return streamDataRef.current[threadId] || defaultStreamData
  }, [])

  const getThreadState = useCallback(
    (threadId: string): ThreadState => {
      return threadStates[threadId] || createDefaultThreadState()
    },
    [threadStates]
  )

  const updateThreadState = useCallback(
    (threadId: string, updater: (prev: ThreadState) => Partial<ThreadState>) => {
      setThreadStates((prev) => {
        const currentState = prev[threadId] || createDefaultThreadState()
        const updates = updater(currentState)
        return {
          ...prev,
          [threadId]: { ...currentState, ...updates }
        }
      })
    },
    []
  )

  const parseErrorMessage = useCallback((error: Error | string): string => {
    const errorMessage = typeof error === "string" ? error : error.message

    const contextWindowMatch = errorMessage.match(
      /prompt is too long: (\d+) tokens > (\d+) maximum/i
    )
    if (contextWindowMatch) {
      const [, usedTokens, maxTokens] = contextWindowMatch
      const usedK = Math.round(parseInt(usedTokens) / 1000)
      const maxK = Math.round(parseInt(maxTokens) / 1000)
      return `Context window exceeded (${usedK}K / ${maxK}K tokens). Please start a new thread.`
    }

    if (errorMessage.includes("rate_limit") || errorMessage.includes("429")) {
      return "Rate limit exceeded. Please wait a moment before sending another message."
    }

    if (
      errorMessage.includes("401") ||
      errorMessage.includes("invalid_api_key") ||
      errorMessage.includes("authentication")
    ) {
      return "Authentication failed. Please check your API key in settings."
    }

    return errorMessage
  }, [])

  const handleError = useCallback(
    (threadId: string, error: Error) => {
      console.error("[ThreadContext] Stream error:", { threadId, error })
      const userFriendlyMessage = parseErrorMessage(error)
      updateThreadState(threadId, () => ({ error: userFriendlyMessage }))
    },
    [parseErrorMessage, updateThreadState]
  )

  const handleCustomEvent = useCallback(
    (threadId: string, data: CustomEventData) => {
      console.log("[ThreadContext] Custom event received:", { threadId, type: data.type, data })
      switch (data.type) {
        case "interrupt":
          if (data.request) {
            updateThreadState(threadId, () => ({ pendingApproval: data.request }))
          }
          break
        case "workspace":
          if (Array.isArray(data.files)) {
            updateThreadState(threadId, (state) => {
              const fileMap = new Map(state.workspaceFiles.map((f) => [f.path, f]))
              for (const f of data.files!) {
                fileMap.set(f.path, { path: f.path, is_dir: f.is_dir, size: f.size })
              }
              return { workspaceFiles: Array.from(fileMap.values()) }
            })
          }
          if (data.path) {
            updateThreadState(threadId, () => ({ workspacePath: data.path }))
          }
          break
        case "subagents":
          if (Array.isArray(data.subagents)) {
            updateThreadState(threadId, () => ({
              subagents: data.subagents!.map((s) => ({
                id: s.id || crypto.randomUUID(),
                name: s.name || "Subagent",
                description: s.description || "",
                status: (s.status || "pending") as "pending" | "running" | "completed" | "failed",
                startedAt: s.startedAt,
                completedAt: s.completedAt
              }))
            }))
          }
          break
        case "token_usage":
          if (data.usage && data.usage.inputTokens !== undefined && data.usage.inputTokens > 0) {
            updateThreadState(threadId, (prev) => {
              const newInputTokens = data.usage!.inputTokens || 0
              const prevInputTokens = prev.tokenUsage?.inputTokens || 0

              if (newInputTokens >= prevInputTokens || !prev.tokenUsage) {
                return {
                  tokenUsage: {
                    inputTokens: newInputTokens,
                    outputTokens: data.usage!.outputTokens || 0,
                    totalTokens: data.usage!.totalTokens || 0,
                    cacheReadTokens: data.usage!.cacheReadTokens,
                    cacheCreationTokens: data.usage!.cacheCreationTokens,
                    lastUpdated: new Date()
                  }
                }
              }
              return {}
            })
          }
          break
      }
    },
    [updateThreadState]
  )

  const getThreadActions = useCallback(
    (threadId: string): ThreadActions => {
      if (actionsCache.current[threadId]) {
        return actionsCache.current[threadId]
      }

      const actions: ThreadActions = {
        appendMessage: (message: Message) => {
          updateThreadState(threadId, (state) => {
            const exists = state.messages.some((m) => m.id === message.id)
            if (exists) {
              return { messages: state.messages.map((m) => (m.id === message.id ? message : m)) }
            }
            return { messages: [...state.messages, message] }
          })
        },
        setMessages: (messages: Message[]) => {
          updateThreadState(threadId, () => ({ messages }))
        },
        setTodos: (todos: Todo[]) => {
          updateThreadState(threadId, () => ({ todos }))
        },
        setWorkspaceFiles: (files: FileInfo[] | ((prev: FileInfo[]) => FileInfo[])) => {
          updateThreadState(threadId, (state) => ({
            workspaceFiles: typeof files === "function" ? files(state.workspaceFiles) : files
          }))
        },
        setWorkspacePath: (path: string | null) => {
          updateThreadState(threadId, () => ({ workspacePath: path }))
        },
        setDaytonaSandboxId: (sandboxId: string | null) => {
          updateThreadState(threadId, () => ({ daytonaSandboxId: sandboxId }))
        },
        setE2bSandboxId: (sandboxId: string | null) => {
          updateThreadState(threadId, () => ({ e2bSandboxId: sandboxId }))
        },
        setSubagents: (subagents: Subagent[]) => {
          updateThreadState(threadId, () => ({ subagents }))
        },
        setPendingApproval: (request: HITLRequest | null) => {
          updateThreadState(threadId, () => ({ pendingApproval: request }))
        },
        setError: (error: string | null) => {
          updateThreadState(threadId, () => ({ error }))
        },
        clearError: () => {
          updateThreadState(threadId, () => ({ error: null }))
        },
        setCurrentModel: async (modelId: string) => {
          updateThreadState(threadId, () => ({ currentModel: modelId }))
          // Persist to backend
          try {
            const response = await fetch(`/api/threads/${threadId}`)
            if (response.ok) {
              const thread = await response.json()
              const metadata = thread.metadata || {}
              await fetch(`/api/threads/${threadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metadata: { ...metadata, model: modelId } })
              })
            }
          } catch (error) {
            console.error("[ThreadContext] Failed to persist model:", error)
          }
        },
        openFile: (path: string, name: string) => {
          updateThreadState(threadId, (state) => {
            if (state.openFiles.some((f) => f.path === path)) {
              return { activeTab: path }
            }
            return { openFiles: [...state.openFiles, { path, name }], activeTab: path }
          })
        },
        closeFile: (path: string) => {
          updateThreadState(threadId, (state) => {
            const newOpenFiles = state.openFiles.filter((f) => f.path !== path)
            const newFileContents = { ...state.fileContents }
            delete newFileContents[path]
            let newActiveTab = state.activeTab
            if (state.activeTab === path) {
              const closedIndex = state.openFiles.findIndex((f) => f.path === path)
              if (newOpenFiles.length === 0) newActiveTab = "agent"
              else if (closedIndex > 0) newActiveTab = newOpenFiles[closedIndex - 1].path
              else newActiveTab = newOpenFiles[0].path
            }
            return {
              openFiles: newOpenFiles,
              activeTab: newActiveTab,
              fileContents: newFileContents
            }
          })
        },
        setActiveTab: (tab: "agent" | string) => {
          updateThreadState(threadId, () => ({ activeTab: tab }))
        },
        setFileContents: (path: string, content: string) => {
          updateThreadState(threadId, (state) => ({
            fileContents: { ...state.fileContents, [path]: content }
          }))
        }
      }

      actionsCache.current[threadId] = actions
      return actions
    },
    [updateThreadState]
  )

  const loadThreadHistory = useCallback(
    async (threadId: string) => {
      const actions = getThreadActions(threadId)

      // Load thread metadata and workspace settings
      try {
        const response = await fetch(`/api/threads/${threadId}`)
        if (response.ok) {
          const thread = await response.json()
          const metadata = thread.metadata || {}

          // Set sandbox ID if present
          if (metadata.e2bSandboxId) {
            actions.setE2bSandboxId(metadata.e2bSandboxId as string)
            actions.setDaytonaSandboxId(null)
            actions.setWorkspacePath(null)
          } else if (metadata.daytonaSandboxId) {
            actions.setDaytonaSandboxId(metadata.daytonaSandboxId as string)
            actions.setE2bSandboxId(null)
            actions.setWorkspacePath(null)
          }

          if (metadata.model) {
            updateThreadState(threadId, () => ({ currentModel: metadata.model as string }))
          }
        }
      } catch (error) {
        console.error("[ThreadContext] Failed to load thread details:", error)
      }

      // Load thread history from checkpoints
      try {
        const response = await fetch(`/api/threads/${threadId}/history`)
        if (response.ok) {
          const history = await response.json()
          if (history.length > 0) {
            const latestCheckpoint = history[0]
            const channelValues = latestCheckpoint.checkpoint?.channel_values

            if (channelValues?.messages && Array.isArray(channelValues.messages)) {
              const messages: Message[] = channelValues.messages.map(
                (
                  msg: {
                    _getType?: () => string
                    type?: string
                    id?: string
                    content?: string | unknown[]
                    tool_calls?: unknown[]
                    tool_call_id?: string
                    name?: string
                  },
                  index: number
                ) => {
                  let role: "user" | "assistant" | "system" | "tool" = "assistant"
                  if (typeof msg._getType === "function") {
                    const type = msg._getType()
                    if (type === "human") role = "user"
                    else if (type === "ai") role = "assistant"
                    else if (type === "system") role = "system"
                    else if (type === "tool") role = "tool"
                  } else if (msg.type) {
                    if (msg.type === "human") role = "user"
                    else if (msg.type === "ai") role = "assistant"
                    else if (msg.type === "system") role = "system"
                    else if (msg.type === "tool") role = "tool"
                  }

                  let content: Message["content"] = ""
                  if (typeof msg.content === "string") content = msg.content
                  else if (Array.isArray(msg.content)) content = msg.content as Message["content"]

                  return {
                    id: msg.id || `msg-${index}`,
                    role,
                    content,
                    tool_calls: msg.tool_calls as Message["tool_calls"],
                    ...(role === "tool" && msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
                    ...(role === "tool" && msg.name && { name: msg.name }),
                    created_at: new Date()
                  }
                }
              )
              actions.setMessages(messages)
            }

            if (channelValues?.todos && Array.isArray(channelValues.todos)) {
              const todos: Todo[] = channelValues.todos.map(
                (todo: { id?: string; content?: string; status?: string }, index: number) => ({
                  id: todo.id || `todo-${index}`,
                  content: todo.content || "",
                  status: (todo.status as Todo["status"]) || "pending"
                })
              )
              actions.setTodos(todos)
            }

            // Handle interrupt state
            const interruptData = channelValues?.__interrupt__
            if (interruptData && Array.isArray(interruptData) && interruptData.length > 0) {
              const interruptValue = interruptData[0]?.value
              const actionRequests = interruptValue?.actionRequests

              if (actionRequests && actionRequests.length > 0) {
                const req = actionRequests[0]
                const hitlRequest: HITLRequest = {
                  id: crypto.randomUUID(),
                  tool_call: {
                    id: crypto.randomUUID(),
                    name: req.action,
                    args: req.args
                  },
                  allowed_decisions: ["approve", "reject", "edit"]
                }
                actions.setPendingApproval(hitlRequest)
              }
            }
          }
        }
      } catch (error) {
        console.error("[ThreadContext] Failed to load thread history:", error)
      }
    },
    [getThreadActions, updateThreadState]
  )

  const initializeThread = useCallback(
    (threadId: string) => {
      if (initializedThreadsRef.current.has(threadId)) return
      initializedThreadsRef.current.add(threadId)

      setActiveThreadIds((prev) => new Set([...prev, threadId]))

      setThreadStates((prev) => {
        if (prev[threadId]) return prev
        return { ...prev, [threadId]: createDefaultThreadState() }
      })

      loadThreadHistory(threadId)
    },
    [loadThreadHistory]
  )

  const cleanupThread = useCallback((threadId: string) => {
    initializedThreadsRef.current.delete(threadId)
    delete actionsCache.current[threadId]
    delete streamDataRef.current[threadId]
    delete streamSubscribersRef.current[threadId]
    setActiveThreadIds((prev) => {
      const next = new Set(prev)
      next.delete(threadId)
      return next
    })
    setThreadStates((prev) => {
      const { [threadId]: _removed, ...rest } = prev
      void _removed
      return rest
    })
  }, [])

  const contextValue = useMemo<ThreadContextValue>(
    () => ({
      getThreadState,
      getThreadActions,
      initializeThread,
      cleanupThread,
      subscribeToStream,
      getStreamData
    }),
    [
      getThreadState,
      getThreadActions,
      initializeThread,
      cleanupThread,
      subscribeToStream,
      getStreamData
    ]
  )

  return (
    <ThreadContext.Provider value={contextValue}>
      {Array.from(activeThreadIds).map((threadId) => (
        <ThreadStreamHolder
          key={threadId}
          threadId={threadId}
          onStreamUpdate={(data) => handleStreamUpdate(threadId, data)}
          onCustomEvent={(data) => handleCustomEvent(threadId, data)}
          onError={(error) => handleError(threadId, error)}
        />
      ))}
      {children}
    </ThreadContext.Provider>
  )
}

export function useThreadContext(): ThreadContextValue {
  const context = useContext(ThreadContext)
  if (!context) throw new Error("useThreadContext must be used within a ThreadProvider")
  return context
}

export function useThreadStream(threadId: string): StreamData {
  const context = useThreadContext()

  const subscribe = useCallback(
    (callback: () => void) => context.subscribeToStream(threadId, callback),
    [context, threadId]
  )

  const getSnapshot = useCallback(() => context.getStreamData(threadId), [context, threadId])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useCurrentThread(threadId: string): ThreadState & ThreadActions {
  const context = useThreadContext()

  useEffect(() => {
    context.initializeThread(threadId)
  }, [threadId, context])

  const state = context.getThreadState(threadId)
  const actions = context.getThreadActions(threadId)

  return { ...state, ...actions }
}

export function useThreadState(threadId: string | null): (ThreadState & ThreadActions) | null {
  const context = useThreadContext()

  useEffect(() => {
    if (threadId) context.initializeThread(threadId)
  }, [threadId, context])

  if (!threadId) return null

  const state = context.getThreadState(threadId)
  const actions = context.getThreadActions(threadId)

  return { ...state, ...actions }
}
