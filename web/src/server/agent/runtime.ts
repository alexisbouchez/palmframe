/**
 * Agent runtime factory for the web application.
 *
 * Creates DeepAgent instances with appropriate sandbox backends (Daytona or E2B)
 * and PostgreSQL checkpointing. No local filesystem support - cloud sandboxes only.
 */

import { createDeepAgent } from "deepagents"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatMistralAI } from "@langchain/mistralai"
import { PostgresSaver } from "@/server/checkpointer/postgres-saver"
import { DaytonaSandbox } from "./daytona-sandbox"
import { E2BSandbox } from "./e2b-sandbox"
import { config, getProviderApiKey } from "@/server/config"
import { DEFAULT_MODEL } from "@/lib/models"
import { generateSystemPrompt } from "./system-prompt"


// Shared PostgreSQL checkpointer instance
let sharedCheckpointer: PostgresSaver | null = null

export function getCheckpointer(): PostgresSaver {
  if (!sharedCheckpointer) {
    sharedCheckpointer = new PostgresSaver()
  }
  return sharedCheckpointer
}

/**
 * Get the appropriate model instance based on configuration.
 */
function getModelInstance(
  modelId?: string
): ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | ChatMistralAI | string {
  const model = modelId || DEFAULT_MODEL
  console.log("[Runtime] Using model:", model)

  // Determine provider from model ID
  if (model.startsWith("claude")) {
    const apiKey = getProviderApiKey("anthropic")
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
    const apiKey = getProviderApiKey("openai")
    console.log("[Runtime] OpenAI API key present:", !!apiKey)
    if (!apiKey) {
      throw new Error("OpenAI API key not configured")
    }
    return new ChatOpenAI({
      model,
      openAIApiKey: apiKey
    })
  } else if (model.startsWith("gemini")) {
    const apiKey = getProviderApiKey("google")
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
    const apiKey = getProviderApiKey("mistral")
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
  /** Thread ID - REQUIRED for checkpointing */
  threadId: string
  /** Model ID to use (defaults to configured default model) */
  modelId?: string
  /** Daytona sandbox ID - if provided, uses Daytona sandbox */
  daytonaSandboxId?: string
  /** E2B sandbox ID - if provided, uses E2B sandbox */
  e2bSandboxId?: string
}

export type AgentRuntime = ReturnType<typeof createDeepAgent>

// Track active sandboxes for cleanup
const activeDaytonaSandboxes = new Map<string, DaytonaSandbox>()
const activeE2BSandboxes = new Map<string, E2BSandbox>()

/**
 * Create an agent runtime with the appropriate cloud sandbox.
 *
 * This function supports Daytona and E2B sandboxes only - no local filesystem.
 */
export async function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  const { threadId, modelId, daytonaSandboxId, e2bSandboxId } = options

  if (!threadId) {
    throw new Error("Thread ID is required for checkpointing.")
  }

  // Require either Daytona or E2B sandbox
  if (!daytonaSandboxId && !e2bSandboxId) {
    throw new Error(
      "Cloud sandbox required. Please select a Daytona or E2B sandbox before running the agent."
    )
  }

  const isDaytona = !!daytonaSandboxId
  const workspacePath = isDaytona ? "/home/daytona" : "/home/user"

  console.log("[Runtime] Creating agent runtime...")
  console.log("[Runtime] Thread ID:", threadId)
  console.log("[Runtime] Workspace path:", workspacePath)
  console.log("[Runtime] Sandbox type:", isDaytona ? "Daytona" : "E2B")
  console.log("[Runtime] Sandbox ID:", daytonaSandboxId || e2bSandboxId)

  const model = getModelInstance(modelId)
  console.log("[Runtime] Model instance created:", typeof model)

  const checkpointer = getCheckpointer()
  console.log("[Runtime] Checkpointer ready")

  // Create backend - either Daytona or E2B
  let backend: DaytonaSandbox | E2BSandbox

  if (isDaytona && daytonaSandboxId) {
    if (!config.sandboxes.daytona.apiKey) {
      throw new Error("Daytona credentials not configured.")
    }

    const daytonaSandbox = new DaytonaSandbox({
      apiKey: config.sandboxes.daytona.apiKey,
      apiUrl: config.sandboxes.daytona.apiUrl,
      sandboxId: daytonaSandboxId,
      workingDir: workspacePath,
      timeout: 120,
      maxOutputBytes: 100_000
    })

    await daytonaSandbox.initialize()
    backend = daytonaSandbox
    activeDaytonaSandboxes.set(threadId, daytonaSandbox)
    console.log("[Runtime] Connected to Daytona sandbox:", daytonaSandboxId)
  } else if (e2bSandboxId) {
    if (!config.sandboxes.e2b.apiKey) {
      throw new Error("E2B credentials not configured.")
    }

    const e2bSandbox = new E2BSandbox({
      apiKey: config.sandboxes.e2b.apiKey,
      sandboxId: e2bSandboxId,
      workingDir: workspacePath,
      timeout: 120,
      maxOutputBytes: 100_000
    })

    await e2bSandbox.initialize()
    backend = e2bSandbox
    activeE2BSandboxes.set(threadId, e2bSandbox)
    console.log("[Runtime] Connected to E2B sandbox:", e2bSandboxId)
  } else {
    throw new Error("No valid sandbox configuration provided.")
  }

  const systemPrompt = generateSystemPrompt(workspacePath)

  // Custom filesystem prompt for cloud sandbox
  const sandboxType = isDaytona ? "Daytona" : "E2B"
  const filesystemSystemPrompt = `You have access to a remote ${sandboxType} sandbox. All file paths use fully qualified absolute system paths.

- ls: list files in a directory (e.g., ls("${workspacePath}"))
- read_file: read a file from the filesystem
- write_file: write to a file in the filesystem
- edit_file: edit a file in the filesystem
- glob: find files matching a pattern (e.g., "**/*.py")
- grep: search for text within files

The workspace root is: ${workspacePath}`

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt,
    filesystemSystemPrompt,
    interruptOn: { execute: true }
  } as Parameters<typeof createDeepAgent>[0])

  console.log(`[Runtime] Deep agent created with ${sandboxType} sandbox`)
  return agent
}

// Get active sandbox for a thread
export function getActiveSandbox(threadId: string): DaytonaSandbox | E2BSandbox | undefined {
  return activeDaytonaSandboxes.get(threadId) || activeE2BSandboxes.get(threadId)
}

// Clean up sandbox for a thread
export async function cleanupSandbox(threadId: string): Promise<void> {
  const daytonaSandbox = activeDaytonaSandboxes.get(threadId)
  if (daytonaSandbox) {
    activeDaytonaSandboxes.delete(threadId)
    console.log(`[Runtime] Removed Daytona sandbox tracking for thread: ${threadId}`)
  }

  const e2bSandbox = activeE2BSandboxes.get(threadId)
  if (e2bSandbox) {
    activeE2BSandboxes.delete(threadId)
    console.log(`[Runtime] Removed E2B sandbox tracking for thread: ${threadId}`)
  }
}

export type DeepAgent = ReturnType<typeof createDeepAgent>
