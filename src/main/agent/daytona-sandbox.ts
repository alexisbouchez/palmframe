/**
 * DaytonaSandbox: Execute commands and file operations in a remote Daytona sandbox.
 *
 * Implements SandboxBackendProtocol using the Daytona SDK for remote sandbox execution.
 * Provides the same interface as LocalSandbox but operations run in a cloud-based
 * isolated environment.
 */

import { Daytona, Sandbox } from "@daytonaio/sdk"
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
 * Options for DaytonaSandbox configuration.
 */
export interface DaytonaSandboxOptions {
  /** Daytona API key */
  apiKey: string
  /** Daytona API URL (default: https://app.daytona.io/api) */
  apiUrl?: string
  /** Existing sandbox ID to connect to (if not provided, creates a new one) */
  sandboxId?: string
  /** Language/runtime for new sandbox (default: typescript) */
  language?: "typescript" | "python" | "javascript"
  /** Working directory within the sandbox (default: /home/daytona) */
  workingDir?: string
  /** Command timeout in seconds (default: 120) */
  timeout?: number
  /** Maximum output bytes before truncation (default: 100000 = ~100KB) */
  maxOutputBytes?: number
  /** Environment variables for the sandbox */
  envVars?: Record<string, string>
  /** Auto-stop interval in minutes (default: 60) */
  autoStopInterval?: number
}

/**
 * DaytonaSandbox backend for remote execution via Daytona.
 *
 * Implements SandboxBackendProtocol to provide file operations and command execution
 * in a remote Daytona sandbox environment.
 */
export class DaytonaSandbox implements SandboxBackendProtocol {
  /** Unique identifier for this sandbox instance */
  readonly id: string

  private readonly daytona: Daytona
  private sandbox: Sandbox | null = null
  private readonly options: DaytonaSandboxOptions
  private readonly timeout: number
  private readonly maxOutputBytes: number
  private readonly workingDir: string
  private initialized = false

  constructor(options: DaytonaSandboxOptions) {
    this.options = options
    this.id = options.sandboxId || `daytona-sandbox-pending`
    this.timeout = options.timeout ?? 120
    this.maxOutputBytes = options.maxOutputBytes ?? 100_000
    this.workingDir = options.workingDir ?? "/home/daytona"

    this.daytona = new Daytona({
      apiKey: options.apiKey,
      apiUrl: options.apiUrl || "https://app.daytona.io/api"
    })
  }

  /**
   * Initialize the sandbox - either connect to existing or create new.
   * Must be called before any operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (this.options.sandboxId) {
      // Connect to existing sandbox
      console.log(`[DaytonaSandbox] Connecting to existing sandbox: ${this.options.sandboxId}`)
      this.sandbox = await this.daytona.get(this.options.sandboxId)
      // Ensure it's running
      await this.sandbox.start()
    } else {
      // Create a new ephemeral sandbox
      console.log(`[DaytonaSandbox] Creating new ephemeral sandbox...`)
      this.sandbox = await this.daytona.create({
        language: this.options.language || "typescript",
        envVars: this.options.envVars,
        autoStopInterval: this.options.autoStopInterval ?? 15, // 15 min idle timeout
        ephemeral: true // Auto-delete when stopped
      })
      // Update ID with actual sandbox ID
      ;(this as { id: string }).id = this.sandbox.id
      console.log(`[DaytonaSandbox] Created ephemeral sandbox: ${this.sandbox.id}`)
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
      throw new Error("Failed to initialize Daytona sandbox")
    }
    return this.sandbox
  }

  /**
   * Get the sandbox ID (for persistence in thread metadata).
   */
  getSandboxId(): string {
    return this.sandbox?.id || this.options.sandboxId || ""
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

      const response = await sandbox.process.executeCommand(
        command,
        this.workingDir,
        undefined,
        this.timeout
      )

      let output = response.result || ""
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
        exitCode: response.exitCode ?? 0,
        truncated
      }
    } catch (error) {
      console.error("[DaytonaSandbox] Execute error:", error)
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
      const files = await sandbox.fs.listFiles(resolvedPath)

      return files.map((f) => ({
        path: f.name,
        is_dir: f.isDir,
        size: f.size,
        modified_at: f.modTime
      }))
    } catch (error) {
      console.error("[DaytonaSandbox] lsInfo error:", error)
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

      const buffer = await sandbox.fs.downloadFile(resolvedPath)
      const content = buffer.toString("utf-8")
      const lines = content.split("\n")

      // Apply offset and limit
      const selectedLines = lines.slice(offset, offset + limit)

      // Format with line numbers (1-indexed)
      return selectedLines.map((line, i) => `${offset + i + 1}\t${line}`).join("\n")
    } catch (error) {
      console.error("[DaytonaSandbox] read error:", error)
      return `Error: ${error instanceof Error ? error.message : "Failed to read file"}`
    }
  }

  /**
   * Search for regex pattern in files.
   */
  async grepRaw(
    pattern: string,
    path?: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _glob?: string | null
  ): Promise<GrepMatch[] | string> {
    try {
      const sandbox = await this.ensureInitialized()
      const searchPath = this.resolvePath(path || this.workingDir)

      // Use Daytona's findFiles API for text search in files
      // findFiles returns Match[] with { file, line, content }
      const matches = await sandbox.fs.findFiles(searchPath, pattern)

      return matches.map((m) => ({
        path: m.file,
        line: m.line,
        text: m.content
      }))
    } catch (error) {
      console.error("[DaytonaSandbox] grepRaw error:", error)
      return `Error: ${error instanceof Error ? error.message : "Search failed"}`
    }
  }

  /**
   * Find files matching a glob pattern.
   */
  async globInfo(pattern: string, path?: string): Promise<FileInfo[]> {
    try {
      const sandbox = await this.ensureInitialized()
      const searchPath = this.resolvePath(path || this.workingDir)

      // Use Daytona's searchFiles API for glob pattern matching
      // searchFiles returns { files: string[] } - just file paths
      const response = await sandbox.fs.searchFiles(searchPath, pattern)

      return (response.files || []).map((filePath) => ({
        path: filePath,
        is_dir: false // searchFiles returns files, not directories
      }))
    } catch (error) {
      console.error("[DaytonaSandbox] globInfo error:", error)
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

      await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), resolvedPath)

      return {
        path: filePath,
        filesUpdate: null // External storage
      }
    } catch (error) {
      console.error("[DaytonaSandbox] write error:", error)
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
      const buffer = await sandbox.fs.downloadFile(resolvedPath)
      let content = buffer.toString("utf-8")

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
      await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), resolvedPath)

      return {
        path: filePath,
        filesUpdate: null,
        occurrences
      }
    } catch (error) {
      console.error("[DaytonaSandbox] edit error:", error)
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
        await sandbox.fs.uploadFile(Buffer.from(content), resolvedPath)
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
        const buffer = await sandbox.fs.downloadFile(resolvedPath)
        results.push({
          path,
          content: new Uint8Array(buffer),
          error: null
        })
      } catch {
        results.push({ path, content: null, error: "file_not_found" })
      }
    }

    return results
  }

  /**
   * Stop the sandbox (for cleanup).
   */
  async stop(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.stop()
        console.log(`[DaytonaSandbox] Stopped sandbox: ${this.sandbox.id}`)
      } catch (error) {
        console.error("[DaytonaSandbox] Stop error:", error)
      }
    }
  }

  /**
   * Delete the sandbox permanently.
   */
  async delete(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.delete()
        console.log(`[DaytonaSandbox] Deleted sandbox: ${this.sandbox.id}`)
      } catch (error) {
        console.error("[DaytonaSandbox] Delete error:", error)
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
 * Create a Daytona client for listing/managing sandboxes.
 */
export function createDaytonaClient(apiKey: string, apiUrl?: string): Daytona {
  return new Daytona({
    apiKey,
    apiUrl: apiUrl || "https://app.daytona.io/api"
  })
}
