/**
 * E2BSandbox: Execute commands and file operations in a remote E2B sandbox.
 *
 * Implements SandboxBackendProtocol using the E2B SDK for remote sandbox execution.
 * Provides the same interface as LocalSandbox but operations run in a cloud-based
 * isolated environment.
 */

import { Sandbox } from "e2b"
import type {
  SandboxBackendProtocol,
  ExecuteResponse,
  FileInfo,
  GrepMatch,
  WriteResult,
  EditResult,
  FileUploadResponse,
  FileDownloadResponse
} from "deepagents"

/**
 * Options for E2BSandbox configuration.
 */
export interface E2BSandboxOptions {
  /** E2B API key */
  apiKey: string
  /** Existing sandbox ID to connect to (if not provided, creates a new one) */
  sandboxId?: string
  /** Template to use for new sandbox (default: base) */
  template?: string
  /** Working directory within the sandbox (default: /home/user) */
  workingDir?: string
  /** Command timeout in seconds (default: 120) */
  timeout?: number
  /** Maximum output bytes before truncation (default: 100000 = ~100KB) */
  maxOutputBytes?: number
  /** Sandbox timeout in milliseconds (default: 5 minutes) */
  sandboxTimeoutMs?: number
}

/**
 * E2BSandbox backend for remote execution via E2B.
 *
 * Implements SandboxBackendProtocol to provide file operations and command execution
 * in a remote E2B sandbox environment.
 */
export class E2BSandbox implements SandboxBackendProtocol {
  /** Unique identifier for this sandbox instance */
  readonly id: string

  private sandbox: Sandbox | null = null
  private readonly options: E2BSandboxOptions
  private readonly timeout: number
  private readonly maxOutputBytes: number
  private readonly workingDir: string
  private initialized = false

  constructor(options: E2BSandboxOptions) {
    this.options = options
    this.id = options.sandboxId || `e2b-sandbox-pending`
    this.timeout = options.timeout ?? 120
    this.maxOutputBytes = options.maxOutputBytes ?? 100_000
    this.workingDir = options.workingDir ?? "/home/user"
  }

  /**
   * Initialize the sandbox - either connect to existing or create new.
   * Must be called before any operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (this.options.sandboxId) {
      // Connect to existing sandbox
      console.log(`[E2BSandbox] Connecting to existing sandbox: ${this.options.sandboxId}`)
      this.sandbox = await Sandbox.connect(this.options.sandboxId, {
        apiKey: this.options.apiKey
      })
    } else {
      // Create a new sandbox
      console.log(`[E2BSandbox] Creating new sandbox...`)
      this.sandbox = await Sandbox.create(this.options.template || "base", {
        apiKey: this.options.apiKey,
        timeoutMs: this.options.sandboxTimeoutMs ?? 300_000 // 5 min default
      })
      // Update ID with actual sandbox ID
      ;(this as { id: string }).id = this.sandbox.sandboxId
      console.log(`[E2BSandbox] Created sandbox: ${this.sandbox.sandboxId}`)
    }

    // Ensure working directory exists
    try {
      await this.sandbox.files.makeDir(this.workingDir)
    } catch {
      // Directory may already exist
    }

    this.initialized = true
  }

  /**
   * Ensure sandbox is initialized before operations.
   */
  private async ensureInitialized(): Promise<Sandbox> {
    if (!this.initialized || !this.sandbox) {
      await this.initialize()
    }
    if (!this.sandbox) {
      throw new Error("Failed to initialize E2B sandbox")
    }
    return this.sandbox
  }

  /**
   * Get the sandbox ID (for persistence in thread metadata).
   */
  getSandboxId(): string {
    return this.sandbox?.sandboxId || this.options.sandboxId || ""
  }

  /**
   * Execute a shell command in the sandbox.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    if (!command || typeof command !== "string") {
      return {
        output: "Error: Shell tool expects a non-empty command string.",
        exitCode: 1,
        truncated: false
      }
    }

    try {
      const sandbox = await this.ensureInitialized()

      const result = await sandbox.commands.run(command, {
        cwd: this.workingDir,
        timeoutMs: this.timeout * 1000
      })

      let output = result.stdout + (result.stderr ? "\n" + result.stderr : "")
      let truncated = false

      // Handle output truncation
      if (output.length > this.maxOutputBytes) {
        output = output.slice(0, this.maxOutputBytes)
        output += `\n\n... Output truncated at ${this.maxOutputBytes} bytes.`
        truncated = true
      }

      if (!output.trim()) {
        output = "<no output>"
      }

      return {
        output,
        exitCode: result.exitCode ?? 0,
        truncated
      }
    } catch (error) {
      console.error("[E2BSandbox] Execute error:", error)
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
        truncated: false
      }
    }
  }

  /**
   * List files in a directory.
   */
  async lsInfo(path: string): Promise<FileInfo[]> {
    try {
      const sandbox = await this.ensureInitialized()
      const resolvedPath = this.resolvePath(path)
      const entries = await sandbox.files.list(resolvedPath)

      return entries.map((e) => ({
        path: e.name,
        is_dir: e.type === "dir",
        size: undefined,
        modified_at: undefined
      }))
    } catch (error) {
      console.error("[E2BSandbox] lsInfo error:", error)
      return []
    }
  }

  /**
   * Read file content.
   */
  async read(filePath: string, offset = 0, limit = 500): Promise<string> {
    try {
      const sandbox = await this.ensureInitialized()
      const resolvedPath = this.resolvePath(filePath)

      const content = await sandbox.files.read(resolvedPath, { format: "text" })
      const lines = content.split("\n")

      // Apply offset and limit
      const selectedLines = lines.slice(offset, offset + limit)

      // Format with line numbers (1-indexed)
      return selectedLines.map((line, i) => `${offset + i + 1}\t${line}`).join("\n")
    } catch (error) {
      console.error("[E2BSandbox] read error:", error)
      return `Error: ${error instanceof Error ? error.message : "Failed to read file"}`
    }
  }

  /**
   * Search for regex pattern in files using grep command.
   */
  async grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null
  ): Promise<GrepMatch[] | string> {
    try {
      const sandbox = await this.ensureInitialized()
      const searchPath = this.resolvePath(path || this.workingDir)

      // Use grep command since E2B doesn't have native search API
      let cmd = `grep -rn "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`
      if (glob) {
        cmd += ` --include="${glob}"`
      }
      cmd += " 2>/dev/null || true"

      const result = await sandbox.commands.run(cmd, {
        cwd: this.workingDir,
        timeoutMs: 30000
      })

      const matches: GrepMatch[] = []
      const lines = result.stdout.split("\n").filter((l) => l.trim())

      for (const line of lines) {
        // Parse grep output: filename:linenum:content
        const match = line.match(/^([^:]+):(\d+):(.*)$/)
        if (match) {
          matches.push({
            path: match[1],
            line: parseInt(match[2], 10),
            text: match[3]
          })
        }
      }

      return matches
    } catch (error) {
      console.error("[E2BSandbox] grepRaw error:", error)
      return `Error: ${error instanceof Error ? error.message : "Search failed"}`
    }
  }

  /**
   * Find files matching a glob pattern using find command.
   */
  async globInfo(pattern: string, path?: string): Promise<FileInfo[]> {
    try {
      const sandbox = await this.ensureInitialized()
      const searchPath = this.resolvePath(path || this.workingDir)

      // Use find command with glob pattern
      const cmd = `find "${searchPath}" -name "${pattern}" -type f 2>/dev/null || true`
      const result = await sandbox.commands.run(cmd, {
        cwd: this.workingDir,
        timeoutMs: 30000
      })

      const files = result.stdout.split("\n").filter((f) => f.trim())
      return files.map((filePath) => ({
        path: filePath,
        is_dir: false
      }))
    } catch (error) {
      console.error("[E2BSandbox] globInfo error:", error)
      return []
    }
  }

  /**
   * Write a file.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      const sandbox = await this.ensureInitialized()
      const resolvedPath = this.resolvePath(filePath)

      // Ensure parent directory exists
      const parentDir = resolvedPath.substring(0, resolvedPath.lastIndexOf("/"))
      if (parentDir) {
        try {
          await sandbox.files.makeDir(parentDir)
        } catch {
          // May already exist
        }
      }

      await sandbox.files.write(resolvedPath, content)

      return {
        path: filePath,
        filesUpdate: null
      }
    } catch (error) {
      console.error("[E2BSandbox] write error:", error)
      return {
        error: error instanceof Error ? error.message : "Failed to write file"
      }
    }
  }

  /**
   * Edit a file by replacing strings.
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll = false
  ): Promise<EditResult> {
    try {
      const sandbox = await this.ensureInitialized()
      const resolvedPath = this.resolvePath(filePath)

      // Read current content
      let content = await sandbox.files.read(resolvedPath, { format: "text" })

      // Count and replace
      let occurrences = 0
      if (replaceAll) {
        const regex = new RegExp(this.escapeRegExp(oldString), "g")
        const matches = content.match(regex)
        occurrences = matches ? matches.length : 0
        content = content.replace(regex, newString)
      } else {
        if (content.includes(oldString)) {
          occurrences = 1
          content = content.replace(oldString, newString)
        }
      }

      if (occurrences === 0) {
        return {
          error: "String not found in file",
          occurrences: 0
        }
      }

      // Write back
      await sandbox.files.write(resolvedPath, content)

      return {
        path: filePath,
        filesUpdate: null,
        occurrences
      }
    } catch (error) {
      console.error("[E2BSandbox] edit error:", error)
      return {
        error: error instanceof Error ? error.message : "Failed to edit file"
      }
    }
  }

  /**
   * Upload multiple files.
   */
  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const results: FileUploadResponse[] = []

    for (const [path, content] of files) {
      try {
        const sandbox = await this.ensureInitialized()
        const resolvedPath = this.resolvePath(path)

        // Convert Uint8Array to string for text files
        const textDecoder = new TextDecoder()
        const stringContent = textDecoder.decode(content)
        await sandbox.files.write(resolvedPath, stringContent)

        results.push({ path, error: null })
      } catch {
        results.push({ path, error: "permission_denied" })
      }
    }

    return results
  }

  /**
   * Download multiple files.
   */
  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const results: FileDownloadResponse[] = []

    for (const path of paths) {
      try {
        const sandbox = await this.ensureInitialized()
        const resolvedPath = this.resolvePath(path)
        const content = await sandbox.files.read(resolvedPath, { format: "bytes" })
        results.push({
          path,
          content: content,
          error: null
        })
      } catch {
        results.push({ path, content: null, error: "file_not_found" })
      }
    }

    return results
  }

  /**
   * Extend the sandbox timeout.
   */
  async setTimeout(timeoutMs: number): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.setTimeout(timeoutMs)
        console.log(`[E2BSandbox] Extended timeout to ${timeoutMs}ms`)
      } catch (error) {
        console.error("[E2BSandbox] setTimeout error:", error)
      }
    }
  }

  /**
   * Kill the sandbox (for cleanup).
   */
  async kill(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.kill()
        console.log(`[E2BSandbox] Killed sandbox: ${this.sandbox.sandboxId}`)
      } catch (error) {
        console.error("[E2BSandbox] Kill error:", error)
      }
    }
  }

  /**
   * Resolve a path relative to the working directory.
   */
  private resolvePath(path: string): string {
    if (path.startsWith("/")) {
      return path
    }
    return `${this.workingDir}/${path}`
  }

  /**
   * Escape special regex characters.
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
}

/**
 * Connect to an existing E2B sandbox.
 */
export async function connectToE2BSandbox(sandboxId: string, apiKey: string): Promise<Sandbox> {
  return Sandbox.connect(sandboxId, { apiKey })
}

/**
 * List all running E2B sandboxes.
 */
export async function listE2BSandboxes(apiKey: string): Promise<
  Array<{
    sandboxId: string
    templateId?: string
    startedAt?: Date
    metadata?: Record<string, string>
  }>
> {
  const sandboxes: Array<{
    sandboxId: string
    templateId?: string
    startedAt?: Date
    metadata?: Record<string, string>
  }> = []

  // E2B uses pagination via hasNext/nextItems
  const paginator = Sandbox.list({ apiKey })
  while (paginator.hasNext) {
    const items = await paginator.nextItems()
    for (const sandbox of items) {
      sandboxes.push({
        sandboxId: sandbox.sandboxId,
        templateId: sandbox.templateId,
        startedAt: sandbox.startedAt,
        metadata: sandbox.metadata
      })
    }
  }

  return sandboxes
}
