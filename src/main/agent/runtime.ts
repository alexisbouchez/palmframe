/* eslint-disable @typescript-eslint/no-unused-vars */
import { createDeepAgent } from "deepagents"
import { getDefaultModel } from "../ipc/models"
import { getApiKey, getThreadCheckpointPath, getDaytonaCredentials } from "../storage"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatMistralAI } from "@langchain/mistralai"
import { SqlJsSaver } from "../checkpointer/sqljs-saver"
import { LocalSandbox } from "./local-sandbox"
import { DaytonaSandbox } from "./daytona-sandbox"

import type * as _lcTypes from "langchain"
import type * as _lcMessages from "@langchain/core/messages"
import type * as _lcLanggraph from "@langchain/langgraph"
import type * as _lcZodTypes from "@langchain/core/utils/types"

import { BASE_SYSTEM_PROMPT } from "./system-prompt"
import { blueskyTools } from "./tools/bluesky"

/**
 * Generate the full system prompt for the agent.
 *
 * @param workspacePath - The workspace path the agent is operating in
 * @param isRemote - Whether this is a remote sandbox (Daytona)
 * @returns The complete system prompt
 */
function getSystemPrompt(workspacePath: string, isRemote = false): string {
  const envType = isRemote ? "remote Daytona sandbox" : "local filesystem"
  const workingDirSection = `
### File System and Paths

**IMPORTANT - Path Handling:**
- You are operating in a ${envType}
- All file paths use fully qualified absolute system paths
- The workspace root is: \`${workspacePath}\`
- Example: \`${workspacePath}/src/index.ts\`, \`${workspacePath}/README.md\`
- To list the workspace root, use \`ls("${workspacePath}")\`
- Always use full absolute paths for all file operations
`

  return workingDirSection + BASE_SYSTEM_PROMPT
}

// Per-thread checkpointer cache
const checkpointers = new Map<string, SqlJsSaver>()

export async function getCheckpointer(threadId: string): Promise<SqlJsSaver> {
  let checkpointer = checkpointers.get(threadId)
  if (!checkpointer) {
    const dbPath = getThreadCheckpointPath(threadId)
    checkpointer = new SqlJsSaver(dbPath)
    await checkpointer.initialize()
    checkpointers.set(threadId, checkpointer)
  }
  return checkpointer
}

export async function closeCheckpointer(threadId: string): Promise<void> {
  const checkpointer = checkpointers.get(threadId)
  if (checkpointer) {
    await checkpointer.close()
    checkpointers.delete(threadId)
  }
}

// Get the appropriate model instance based on configuration
function getModelInstance(
  modelId?: string
): ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | ChatMistralAI | string {
  const model = modelId || getDefaultModel()
  console.log("[Runtime] Using model:", model)

  // Determine provider from model ID
  if (model.startsWith("claude")) {
    const apiKey = getApiKey("anthropic")
    console.log("[Runtime] Anthropic API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("Anthropic API key not configured")
    }
    return new ChatAnthropic({
      model,
      anthropicApiKey: apiKey
    })
  } else if (
    model.startsWith("gpt") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  ) {
    const apiKey = getApiKey("openai")
    console.log("[Runtime] OpenAI API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("OpenAI API key not configured")
    }
    return new ChatOpenAI({
      model,
      openAIApiKey: apiKey
    })
  } else if (model.startsWith("gemini")) {
    const apiKey = getApiKey("google")
    console.log("[Runtime] Google API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("Google API key not configured")
    }
    return new ChatGoogleGenerativeAI({
      model,
      apiKey: apiKey
    })
  } else if (
    model.startsWith("mistral") ||
    model.startsWith("codestral") ||
    model.startsWith("pixtral") ||
    model.startsWith("ministral")
  ) {
    const apiKey = getApiKey("mistral")
    console.log("[Runtime] Mistral API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("Mistral API key not configured")
    }
    return new ChatMistralAI({
      model,
      apiKey: apiKey
    })
  }

  // Default to model string (let deepagents handle it)
  return model
}

export interface CreateAgentRuntimeOptions {
  /** Thread ID - REQUIRED for per-thread checkpointing */
  threadId: string
  /** Model ID to use (defaults to configured default model) */
  modelId?: string
  /** Workspace path - REQUIRED for local agent, or working directory for Daytona */
  workspacePath: string
  /** Daytona sandbox ID - if provided, uses remote Daytona sandbox instead of local */
  daytonaSandboxId?: string
}

// Create agent runtime with configured model and checkpointer
export type AgentRuntime = ReturnType<typeof createDeepAgent>

// Track active Daytona sandboxes for cleanup
const activeDaytonaSandboxes = new Map<string, DaytonaSandbox>()

export async function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  const { threadId, modelId, workspacePath, daytonaSandboxId } = options

  if (!threadId) {
    throw new Error("Thread ID is required for checkpointing.")
  }

  // For Daytona, workspacePath is the working directory inside the sandbox
  const isRemote = !!daytonaSandboxId
  const effectiveWorkspacePath = isRemote ? workspacePath || "/home/daytona" : workspacePath

  if (!isRemote && !workspacePath) {
    throw new Error(
      "Workspace path is required. Please select a workspace folder before running the agent."
    )
  }

  console.log("[Runtime] Creating agent runtime...")
  console.log("[Runtime] Thread ID:", threadId)
  console.log("[Runtime] Workspace path:", effectiveWorkspacePath)
  console.log("[Runtime] Remote (Daytona):", isRemote)

  const model = getModelInstance(modelId)
  console.log("[Runtime] Model instance created:", typeof model)

  const checkpointer = await getCheckpointer(threadId)
  console.log("[Runtime] Checkpointer ready for thread:", threadId)

  // Create backend - either local or Daytona
  let backend: LocalSandbox | DaytonaSandbox

  if (isRemote && daytonaSandboxId) {
    const daytonaCredentials = getDaytonaCredentials()
    if (!daytonaCredentials) {
      throw new Error("Daytona credentials not configured. Please configure in Settings.")
    }

    const daytonaSandbox = new DaytonaSandbox({
      apiKey: daytonaCredentials.apiKey,
      apiUrl: daytonaCredentials.apiUrl,
      sandboxId: daytonaSandboxId,
      workingDir: effectiveWorkspacePath,
      timeout: 120, // 2 minutes
      maxOutputBytes: 100_000
    })

    // Initialize the sandbox (connect to existing)
    await daytonaSandbox.initialize()
    backend = daytonaSandbox

    // Track for cleanup
    activeDaytonaSandboxes.set(threadId, daytonaSandbox)
    console.log("[Runtime] Connected to Daytona sandbox:", daytonaSandboxId)
  } else {
    backend = new LocalSandbox({
      rootDir: effectiveWorkspacePath,
      virtualMode: false,
      timeout: 120_000,
      maxOutputBytes: 100_000
    })
    console.log("[Runtime] Created LocalSandbox at:", effectiveWorkspacePath)
  }

  const systemPrompt = getSystemPrompt(effectiveWorkspacePath, isRemote)

  // Custom filesystem prompt
  const envDesc = isRemote ? "remote Daytona sandbox" : "local filesystem"
  const filesystemSystemPrompt = `You have access to a ${envDesc}. All file paths use fully qualified absolute system paths.

- ls: list files in a directory (e.g., ls("${effectiveWorkspacePath}"))
- read_file: read a file from the filesystem
- write_file: write to a file in the filesystem
- edit_file: edit a file in the filesystem
- glob: find files matching a pattern (e.g., "**/*.py")
- grep: search for text within files

The workspace root is: ${effectiveWorkspacePath}`

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt,
    filesystemSystemPrompt,
    tools: blueskyTools,
    interruptOn: { execute: true }
  } as Parameters<typeof createDeepAgent>[0])

  console.log(`[Runtime] Deep agent created with ${isRemote ? "DaytonaSandbox" : "LocalSandbox"}`)
  return agent
}

// Get active Daytona sandbox for a thread
export function getActiveDaytonaSandbox(threadId: string): DaytonaSandbox | undefined {
  return activeDaytonaSandboxes.get(threadId)
}

// Clean up Daytona sandbox for a thread
export async function cleanupDaytonaSandbox(threadId: string): Promise<void> {
  const sandbox = activeDaytonaSandboxes.get(threadId)
  if (sandbox) {
    // Just remove from tracking - don't stop/delete as the sandbox may be reused
    activeDaytonaSandboxes.delete(threadId)
    console.log(`[Runtime] Removed Daytona sandbox tracking for thread: ${threadId}`)
  }
}

export type DeepAgent = ReturnType<typeof createDeepAgent>

// Clean up all checkpointer resources
export async function closeRuntime(): Promise<void> {
  const closePromises = Array.from(checkpointers.values()).map((cp) => cp.close())
  await Promise.all(closePromises)
  checkpointers.clear()
}
