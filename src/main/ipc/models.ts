import { IpcMain, dialog, app } from "electron"
import Store from "electron-store"
import * as fs from "fs/promises"
import * as path from "path"
import type {
  ModelConfig,
  Provider,
  SetApiKeyParams,
  WorkspaceSetParams,
  WorkspaceLoadParams,
  WorkspaceFileParams
} from "../types"
import { startWatching, stopWatching } from "../services/workspace-watcher"
import {
  getOpenworkDir,
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
  getBlueskyCredentials,
  setBlueskyCredentials,
  deleteBlueskyCredentials,
  hasBlueskyCredentials,
  getDaytonaCredentials,
  setDaytonaCredentials,
  deleteDaytonaCredentials,
  hasDaytonaCredentials,
  getE2BCredentials,
  setE2BCredentials,
  deleteE2BCredentials,
  hasE2BCredentials
} from "../storage"
import { getThread, updateThread } from "../db"
import { createDaytonaClient } from "../agent/daytona-sandbox"
import { Sandbox as E2BSandbox } from "e2b"

// Store for non-sensitive settings only (no encryption needed)
const store = new Store({
  name: "settings",
  cwd: getOpenworkDir()
})

// Provider configurations
const PROVIDERS: Omit<Provider, "hasApiKey">[] = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
  { id: "mistral", name: "Mistral" }
]

// Available models configuration (updated Jan 2026)
const AVAILABLE_MODELS: ModelConfig[] = [
  // Anthropic Claude 4.5 series (latest as of Jan 2026)
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    model: "claude-opus-4-5-20251101",
    description: "Premium model with maximum intelligence",
    available: true
  },
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    description: "Best balance of intelligence, speed, and cost for agents",
    available: true
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    description: "Fastest model with near-frontier intelligence",
    available: true
  },
  // Anthropic Claude legacy models
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    model: "claude-opus-4-1-20250805",
    description: "Previous generation premium model with extended thinking",
    available: true
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    description: "Fast and capable previous generation model",
    available: true
  },
  // OpenAI GPT-5 series (latest as of Jan 2026)
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    model: "gpt-5.2",
    description: "Latest flagship with enhanced coding and agentic capabilities",
    available: true
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    model: "gpt-5.1",
    description: "Advanced reasoning and robust performance",
    available: true
  },
  // OpenAI o-series reasoning models
  {
    id: "o3",
    name: "o3",
    provider: "openai",
    model: "o3",
    description: "Advanced reasoning for complex problem-solving",
    available: true
  },
  {
    id: "o3-mini",
    name: "o3 Mini",
    provider: "openai",
    model: "o3-mini",
    description: "Cost-effective reasoning with faster response times",
    available: true
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    provider: "openai",
    model: "o4-mini",
    description: "Fast, efficient reasoning model succeeding o3",
    available: true
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    model: "o1",
    description: "Premium reasoning for research, coding, math and science",
    available: true
  },
  // OpenAI GPT-4 series
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
    description: "Strong instruction-following with 1M context window",
    available: true
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    model: "gpt-4.1-mini",
    description: "Faster, smaller version balancing performance and efficiency",
    available: true
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    model: "gpt-4.1-nano",
    description: "Most cost-efficient for lighter tasks",
    available: true
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    description: "Versatile model for text generation and comprehension",
    available: true
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    description: "Cost-efficient variant with faster response times",
    available: true
  },
  // Google Gemini models
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    model: "gemini-3-pro-preview",
    description: "State-of-the-art reasoning and multimodal understanding",
    available: true
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    model: "gemini-3-flash-preview",
    description: "Fast frontier-class model with low latency and cost",
    available: true
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    model: "gemini-2.5-pro",
    description: "High-capability model for complex reasoning and coding",
    available: true
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    model: "gemini-2.5-flash",
    description: "Lightning-fast with balance of intelligence and latency",
    available: true
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    description: "Fast, low-cost, high-performance model",
    available: true
  },
  // Mistral AI models
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    model: "mistral-large-latest",
    description: "Flagship model with top-tier reasoning and multilingual capabilities",
    available: true
  },
  {
    id: "mistral-medium-latest",
    name: "Mistral Medium",
    provider: "mistral",
    model: "mistral-medium-latest",
    description: "Balanced model for complex tasks with good cost efficiency",
    available: true
  },
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
    model: "mistral-small-latest",
    description: "Fast and cost-effective for simpler tasks",
    available: true
  },
  {
    id: "codestral-latest",
    name: "Codestral",
    provider: "mistral",
    model: "codestral-latest",
    description: "Specialized model for code generation and understanding",
    available: true
  },
  {
    id: "pixtral-large-latest",
    name: "Pixtral Large",
    provider: "mistral",
    model: "pixtral-large-latest",
    description: "Multimodal model with advanced vision capabilities",
    available: true
  },
  {
    id: "ministral-8b-latest",
    name: "Ministral 8B",
    provider: "mistral",
    model: "ministral-8b-latest",
    description: "Compact model optimized for edge deployment and low latency",
    available: true
  }
]

export function registerModelHandlers(ipcMain: IpcMain): void {
  // List available models
  ipcMain.handle("models:list", async () => {
    // Check which models have API keys configured
    return AVAILABLE_MODELS.map((model) => ({
      ...model,
      available: hasApiKey(model.provider)
    }))
  })

  // Get default model
  ipcMain.handle("models:getDefault", async () => {
    return store.get("defaultModel", "claude-sonnet-4-5-20250929") as string
  })

  // Set default model
  ipcMain.handle("models:setDefault", async (_event, modelId: string) => {
    store.set("defaultModel", modelId)
  })

  // Set API key for a provider (stored in ~/.palmframe/.env, falls back to legacy ~/.openwork/.env)
  ipcMain.handle("models:setApiKey", async (_event, { provider, apiKey }: SetApiKeyParams) => {
    setApiKey(provider, apiKey)
  })

  // Get API key for a provider (from ~/.palmframe/.env, legacy ~/.openwork/.env, or process.env)
  ipcMain.handle("models:getApiKey", async (_event, provider: string) => {
    return getApiKey(provider) ?? null
  })

  // Delete API key for a provider
  ipcMain.handle("models:deleteApiKey", async (_event, provider: string) => {
    deleteApiKey(provider)
  })

  // List providers with their API key status
  ipcMain.handle("models:listProviders", async () => {
    return PROVIDERS.map((provider) => ({
      ...provider,
      hasApiKey: hasApiKey(provider.id)
    }))
  })

  // Bluesky credentials management
  ipcMain.handle("bluesky:hasCredentials", async () => {
    return hasBlueskyCredentials()
  })

  ipcMain.handle("bluesky:getCredentials", async () => {
    const credentials = getBlueskyCredentials()
    if (credentials) {
      // Return identifier only for display, not the password
      return { identifier: credentials.identifier, hasPassword: true }
    }
    return null
  })

  ipcMain.handle(
    "bluesky:setCredentials",
    async (_event, { identifier, appPassword }: { identifier: string; appPassword: string }) => {
      setBlueskyCredentials(identifier, appPassword)
    }
  )

  ipcMain.handle("bluesky:deleteCredentials", async () => {
    deleteBlueskyCredentials()
  })

  // Daytona credentials management
  ipcMain.handle("daytona:hasCredentials", async () => {
    return hasDaytonaCredentials()
  })

  ipcMain.handle("daytona:getCredentials", async () => {
    const credentials = getDaytonaCredentials()
    if (credentials) {
      // Return API URL but mask the key
      return { apiUrl: credentials.apiUrl, hasApiKey: true }
    }
    return null
  })

  ipcMain.handle(
    "daytona:setCredentials",
    async (_event, { apiKey, apiUrl }: { apiKey: string; apiUrl?: string }) => {
      setDaytonaCredentials(apiKey, apiUrl)
    }
  )

  ipcMain.handle("daytona:deleteCredentials", async () => {
    deleteDaytonaCredentials()
  })

  // Daytona sandbox management
  ipcMain.handle("daytona:listSandboxes", async () => {
    const credentials = getDaytonaCredentials()
    if (!credentials) {
      return { error: "Daytona credentials not configured", sandboxes: [] }
    }

    try {
      const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
      const result = await client.list()
      return {
        sandboxes: result.items.map((s) => ({
          id: s.id,
          state: s.state || "unknown",
          createdAt: s.createdAt,
          labels: s.labels
        }))
      }
    } catch (error) {
      console.error("[Daytona] List sandboxes error:", error)
      return {
        error: error instanceof Error ? error.message : "Failed to list sandboxes",
        sandboxes: []
      }
    }
  })

  ipcMain.handle(
    "daytona:createSandbox",
    async (
      _event,
      {
        language,
        envVars
      }: { language?: "typescript" | "python" | "javascript"; envVars?: Record<string, string> }
    ) => {
      const credentials = getDaytonaCredentials()
      if (!credentials) {
        return { error: "Daytona credentials not configured" }
      }

      try {
        const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
        console.log("[Daytona] Creating new ephemeral sandbox...")
        const sandbox = await client.create({
          language: language || "typescript",
          envVars,
          autoStopInterval: 15, // 15 minutes auto-stop (idle timeout)
          ephemeral: true // Auto-delete when stopped
        })
        console.log(`[Daytona] Created ephemeral sandbox: ${sandbox.id}`)
        return {
          id: sandbox.id,
          state: sandbox.state || "running"
        }
      } catch (error) {
        console.error("[Daytona] Create sandbox error:", error)
        return { error: error instanceof Error ? error.message : "Failed to create sandbox" }
      }
    }
  )

  ipcMain.handle("daytona:deleteSandbox", async (_event, { sandboxId }: { sandboxId: string }) => {
    const credentials = getDaytonaCredentials()
    if (!credentials) {
      return { error: "Daytona credentials not configured" }
    }

    try {
      const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
      const sandbox = await client.get(sandboxId)
      await sandbox.delete()
      console.log(`[Daytona] Deleted sandbox: ${sandboxId}`)
      return { success: true }
    } catch (error) {
      console.error("[Daytona] Delete sandbox error:", error)
      return { error: error instanceof Error ? error.message : "Failed to delete sandbox" }
    }
  })

  ipcMain.handle("daytona:startSandbox", async (_event, { sandboxId }: { sandboxId: string }) => {
    const credentials = getDaytonaCredentials()
    if (!credentials) {
      return { error: "Daytona credentials not configured" }
    }

    try {
      const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
      const sandbox = await client.get(sandboxId)
      await sandbox.start()
      console.log(`[Daytona] Started sandbox: ${sandboxId}`)
      return { success: true }
    } catch (error) {
      console.error("[Daytona] Start sandbox error:", error)
      return { error: error instanceof Error ? error.message : "Failed to start sandbox" }
    }
  })

  ipcMain.handle("daytona:stopSandbox", async (_event, { sandboxId }: { sandboxId: string }) => {
    const credentials = getDaytonaCredentials()
    if (!credentials) {
      return { error: "Daytona credentials not configured" }
    }

    try {
      const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
      const sandbox = await client.get(sandboxId)
      await sandbox.stop()
      console.log(`[Daytona] Stopped sandbox: ${sandboxId}`)
      return { success: true }
    } catch (error) {
      console.error("[Daytona] Stop sandbox error:", error)
      return { error: error instanceof Error ? error.message : "Failed to stop sandbox" }
    }
  })

  // List files from a Daytona sandbox
  ipcMain.handle(
    "daytona:listFiles",
    async (_event, { sandboxId, path }: { sandboxId: string; path?: string }) => {
      const credentials = getDaytonaCredentials()
      if (!credentials) {
        return { error: "Daytona credentials not configured", files: [] }
      }

      try {
        const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
        const sandbox = await client.get(sandboxId)

        // Default to /home/daytona if no path specified
        const listPath = path || "/home/daytona"
        console.log(`[Daytona] Listing files in sandbox ${sandboxId} at ${listPath}`)

        const files = await sandbox.fs.listFiles(listPath)

        return {
          files: files.map((f) => ({
            path: `${listPath}/${f.name}`.replace(/\/+/g, "/"),
            is_dir: f.isDir,
            size: f.size,
            modified_at: f.modTime
          }))
        }
      } catch (error) {
        console.error("[Daytona] List files error:", error)
        return {
          error: error instanceof Error ? error.message : "Failed to list files",
          files: []
        }
      }
    }
  )

  // E2B credentials management
  ipcMain.handle("e2b:hasCredentials", async () => {
    return hasE2BCredentials()
  })

  ipcMain.handle("e2b:getCredentials", async () => {
    const credentials = getE2BCredentials()
    if (credentials) {
      // Return that API key is set (don't expose the actual key)
      return { hasApiKey: true }
    }
    return null
  })

  ipcMain.handle("e2b:setCredentials", async (_event, { apiKey }: { apiKey: string }) => {
    setE2BCredentials(apiKey)
  })

  ipcMain.handle("e2b:deleteCredentials", async () => {
    deleteE2BCredentials()
  })

  // E2B sandbox management
  ipcMain.handle("e2b:listSandboxes", async () => {
    const credentials = getE2BCredentials()
    if (!credentials) {
      return { error: "E2B credentials not configured", sandboxes: [] }
    }

    try {
      const sandboxes: Array<{
        sandboxId: string
        templateId?: string
        startedAt?: string
        metadata?: Record<string, string>
      }> = []

      // E2B uses pagination via hasNext/nextItems
      const paginator = E2BSandbox.list({ apiKey: credentials.apiKey })
      while (paginator.hasNext) {
        const items = await paginator.nextItems()
        for (const sandbox of items) {
          sandboxes.push({
            sandboxId: sandbox.sandboxId,
            templateId: sandbox.templateId,
            startedAt: sandbox.startedAt?.toISOString(),
            metadata: sandbox.metadata
          })
        }
      }

      return { sandboxes }
    } catch (error) {
      console.error("[E2B] List sandboxes error:", error)
      return {
        error: error instanceof Error ? error.message : "Failed to list sandboxes",
        sandboxes: []
      }
    }
  })

  ipcMain.handle(
    "e2b:createSandbox",
    async (_event, { template, timeoutMs }: { template?: string; timeoutMs?: number }) => {
      const credentials = getE2BCredentials()
      if (!credentials) {
        return { error: "E2B credentials not configured" }
      }

      try {
        console.log("[E2B] Creating new sandbox...")
        const sandbox = await E2BSandbox.create(template || "base", {
          apiKey: credentials.apiKey,
          timeoutMs: timeoutMs ?? 300_000 // 5 min default
        })
        console.log(`[E2B] Created sandbox: ${sandbox.sandboxId}`)

        // Ensure working directory exists
        try {
          await sandbox.files.makeDir("/home/user")
        } catch {
          // May already exist
        }

        return {
          sandboxId: sandbox.sandboxId,
          templateId: template || "base"
        }
      } catch (error) {
        console.error("[E2B] Create sandbox error:", error)
        return { error: error instanceof Error ? error.message : "Failed to create sandbox" }
      }
    }
  )

  ipcMain.handle("e2b:killSandbox", async (_event, { sandboxId }: { sandboxId: string }) => {
    const credentials = getE2BCredentials()
    if (!credentials) {
      return { error: "E2B credentials not configured" }
    }

    try {
      const sandbox = await E2BSandbox.connect(sandboxId, { apiKey: credentials.apiKey })
      await sandbox.kill()
      console.log(`[E2B] Killed sandbox: ${sandboxId}`)
      return { success: true }
    } catch (error) {
      console.error("[E2B] Kill sandbox error:", error)
      return { error: error instanceof Error ? error.message : "Failed to kill sandbox" }
    }
  })

  ipcMain.handle(
    "e2b:setTimeout",
    async (_event, { sandboxId, timeoutMs }: { sandboxId: string; timeoutMs: number }) => {
      const credentials = getE2BCredentials()
      if (!credentials) {
        return { error: "E2B credentials not configured" }
      }

      try {
        const sandbox = await E2BSandbox.connect(sandboxId, { apiKey: credentials.apiKey })
        await sandbox.setTimeout(timeoutMs)
        console.log(`[E2B] Extended sandbox timeout: ${sandboxId}`)
        return { success: true }
      } catch (error) {
        console.error("[E2B] Set timeout error:", error)
        return { error: error instanceof Error ? error.message : "Failed to set timeout" }
      }
    }
  )

  // List files from an E2B sandbox
  ipcMain.handle(
    "e2b:listFiles",
    async (_event, { sandboxId, path }: { sandboxId: string; path?: string }) => {
      const credentials = getE2BCredentials()
      if (!credentials) {
        return { error: "E2B credentials not configured", files: [] }
      }

      try {
        const sandbox = await E2BSandbox.connect(sandboxId, { apiKey: credentials.apiKey })

        // Default to /home/user if no path specified
        const listPath = path || "/home/user"
        console.log(`[E2B] Listing files in sandbox ${sandboxId} at ${listPath}`)

        const entries = await sandbox.files.list(listPath)

        return {
          files: entries.map((e) => ({
            path: `${listPath}/${e.name}`.replace(/\/+/g, "/"),
            is_dir: e.type === "dir",
            size: undefined, // E2B doesn't provide size in list
            modified_at: undefined
          }))
        }
      } catch (error) {
        console.error("[E2B] List files error:", error)
        return {
          error: error instanceof Error ? error.message : "Failed to list files",
          files: []
        }
      }
    }
  )

  // Sync version info
  ipcMain.on("app:version", (event) => {
    event.returnValue = app.getVersion()
  })

  // Get workspace path for a thread (from thread metadata)
  ipcMain.handle("workspace:get", async (_event, threadId?: string) => {
    if (!threadId) {
      // Fallback to global setting for backwards compatibility
      return store.get("workspacePath", null) as string | null
    }

    // Get from thread metadata via threads:get
    const thread = getThread(threadId)
    if (!thread?.metadata) return null

    const metadata = JSON.parse(thread.metadata)
    return metadata.workspacePath || null
  })

  // Set workspace path for a thread (stores in thread metadata)
  ipcMain.handle(
    "workspace:set",
    async (_event, { threadId, path: newPath }: WorkspaceSetParams) => {
      if (!threadId) {
        // Fallback to global setting
        if (newPath) {
          store.set("workspacePath", newPath)
        } else {
          store.delete("workspacePath")
        }
        return newPath
      }

      const thread = getThread(threadId)
      if (!thread) return null

      const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
      metadata.workspacePath = newPath
      updateThread(threadId, { metadata: JSON.stringify(metadata) })

      // Update file watcher
      if (newPath) {
        startWatching(threadId, newPath)
      } else {
        stopWatching(threadId)
      }

      return newPath
    }
  )

  // Select workspace folder via dialog (for a specific thread)
  ipcMain.handle("workspace:select", async (_event, threadId?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Workspace Folder",
      message: "Choose a folder for the agent to work in"
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = result.filePaths[0]

    if (threadId) {
      const thread = getThread(threadId)
      if (thread) {
        const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
        metadata.workspacePath = selectedPath
        updateThread(threadId, { metadata: JSON.stringify(metadata) })

        // Start watching the new workspace
        startWatching(threadId, selectedPath)
      }
    } else {
      // Fallback to global
      store.set("workspacePath", selectedPath)
    }

    return selectedPath
  })

  // Load files from disk into the workspace view
  ipcMain.handle("workspace:loadFromDisk", async (_event, { threadId }: WorkspaceLoadParams) => {
    // Get workspace path from thread metadata
    const thread = getThread(threadId)
    const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
    const workspacePath = metadata.workspacePath as string | null

    if (!workspacePath) {
      return { success: false, error: "No workspace folder linked", files: [] }
    }

    try {
      const files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }> = []

      // Recursively read directory
      async function readDir(dirPath: string, relativePath: string = ""): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          // Skip hidden files and common non-project files
          if (entry.name.startsWith(".") || entry.name === "node_modules") {
            continue
          }

          const fullPath = path.join(dirPath, entry.name)
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

          if (entry.isDirectory()) {
            files.push({
              path: "/" + relPath,
              is_dir: true
            })
            await readDir(fullPath, relPath)
          } else {
            const stat = await fs.stat(fullPath)
            files.push({
              path: "/" + relPath,
              is_dir: false,
              size: stat.size,
              modified_at: stat.mtime.toISOString()
            })
          }
        }
      }

      await readDir(workspacePath)

      // Start watching for file changes
      startWatching(threadId, workspacePath)

      return {
        success: true,
        files,
        workspacePath
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
        files: []
      }
    }
  })

  // Read a single file's contents from disk (or from Daytona/E2B sandbox)
  ipcMain.handle(
    "workspace:readFile",
    async (_event, { threadId, filePath }: WorkspaceFileParams) => {
      // Get workspace path and sandbox IDs from thread metadata
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | null
      const daytonaSandboxId = metadata.daytonaSandboxId as string | null
      const e2bSandboxId = metadata.e2bSandboxId as string | null

      // Handle E2B sandbox mode
      if (e2bSandboxId) {
        const credentials = getE2BCredentials()
        if (!credentials) {
          return { success: false, error: "E2B credentials not configured" }
        }

        try {
          const sandbox = await E2BSandbox.connect(e2bSandboxId, { apiKey: credentials.apiKey })

          // File paths from E2B are already absolute
          console.log(`[E2B] Reading file: ${filePath}`)
          const content = await sandbox.files.read(filePath, { format: "text" })

          return {
            success: true,
            content,
            size: content.length
          }
        } catch (error) {
          console.error("[E2B] Read file error:", error)
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file"
          }
        }
      }

      // Handle Daytona sandbox mode
      if (daytonaSandboxId) {
        const credentials = getDaytonaCredentials()
        if (!credentials) {
          return { success: false, error: "Daytona credentials not configured" }
        }

        try {
          const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
          const sandbox = await client.get(daytonaSandboxId)

          // File paths from Daytona are already absolute
          console.log(`[Daytona] Reading file: ${filePath}`)
          const buffer = await sandbox.fs.downloadFile(filePath)
          const content = buffer.toString("utf-8")

          return {
            success: true,
            content,
            size: buffer.length
          }
        } catch (error) {
          console.error("[Daytona] Read file error:", error)
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file"
          }
        }
      }

      // Local filesystem mode
      if (!workspacePath) {
        return {
          success: false,
          error: "No workspace folder linked"
        }
      }

      try {
        // Convert virtual path to full disk path
        const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath
        const fullPath = path.join(workspacePath, relativePath)

        // Security check: ensure the resolved path is within the workspace
        const resolvedPath = path.resolve(fullPath)
        const resolvedWorkspace = path.resolve(workspacePath)
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: "Access denied: path outside workspace" }
        }

        // Check if file exists
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          return { success: false, error: "Cannot read directory as file" }
        }

        // Read file contents
        const content = await fs.readFile(fullPath, "utf-8")

        return {
          success: true,
          content,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error"
        }
      }
    }
  )

  // Read a binary file (images, PDFs, etc.) and return as base64
  ipcMain.handle(
    "workspace:readBinaryFile",
    async (_event, { threadId, filePath }: WorkspaceFileParams) => {
      // Get workspace path and sandbox IDs from thread metadata
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | null
      const daytonaSandboxId = metadata.daytonaSandboxId as string | null
      const e2bSandboxId = metadata.e2bSandboxId as string | null

      // Handle E2B sandbox mode
      if (e2bSandboxId) {
        const credentials = getE2BCredentials()
        if (!credentials) {
          return { success: false, error: "E2B credentials not configured" }
        }

        try {
          const sandbox = await E2BSandbox.connect(e2bSandboxId, { apiKey: credentials.apiKey })

          // File paths from E2B are already absolute
          console.log(`[E2B] Reading binary file: ${filePath}`)
          const bytes = await sandbox.files.read(filePath, { format: "bytes" })
          const base64 = Buffer.from(bytes).toString("base64")

          return {
            success: true,
            content: base64,
            size: bytes.length
          }
        } catch (error) {
          console.error("[E2B] Read binary file error:", error)
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file"
          }
        }
      }

      // Handle Daytona sandbox mode
      if (daytonaSandboxId) {
        const credentials = getDaytonaCredentials()
        if (!credentials) {
          return { success: false, error: "Daytona credentials not configured" }
        }

        try {
          const client = createDaytonaClient(credentials.apiKey, credentials.apiUrl)
          const sandbox = await client.get(daytonaSandboxId)

          // File paths from Daytona are already absolute
          console.log(`[Daytona] Reading binary file: ${filePath}`)
          const buffer = await sandbox.fs.downloadFile(filePath)
          const base64 = buffer.toString("base64")

          return {
            success: true,
            content: base64,
            size: buffer.length
          }
        } catch (error) {
          console.error("[Daytona] Read binary file error:", error)
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file"
          }
        }
      }

      // Local filesystem mode
      if (!workspacePath) {
        return {
          success: false,
          error: "No workspace folder linked"
        }
      }

      try {
        // Convert virtual path to full disk path
        const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath
        const fullPath = path.join(workspacePath, relativePath)

        // Security check: ensure the resolved path is within the workspace
        const resolvedPath = path.resolve(fullPath)
        const resolvedWorkspace = path.resolve(workspacePath)
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
          return { success: false, error: "Access denied: path outside workspace" }
        }

        // Check if file exists
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          return { success: false, error: "Cannot read directory as file" }
        }

        // Read file as binary and convert to base64
        const buffer = await fs.readFile(fullPath)
        const base64 = buffer.toString("base64")

        return {
          success: true,
          content: base64,
          size: stat.size,
          modified_at: stat.mtime.toISOString()
        }
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Unknown error"
        }
      }
    }
  )
}

// Re-export getApiKey from storage for use in agent runtime
export { getApiKey } from "../storage"

export function getDefaultModel(): string {
  return store.get("defaultModel", "claude-sonnet-4-5-20250929") as string
}
