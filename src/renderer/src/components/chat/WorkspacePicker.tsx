import { selectWorkspaceFolder } from "@/lib/workspace-utils"
import {
  Check,
  ChevronDown,
  Folder,
  Cloud,
  Plus,
  Loader2,
  Trash2,
  Play,
  Square,
  Box
} from "lucide-react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCurrentThread } from "@/lib/thread-context"
import { cn } from "@/lib/utils"

interface WorkspacePickerProps {
  threadId: string
}

interface DaytonaSandbox {
  id: string
  state: string
  createdAt?: string
  labels?: Record<string, string>
}

interface E2BSandbox {
  sandboxId: string
  templateId?: string
  startedAt?: string
  metadata?: Record<string, string>
}

type WorkspaceMode = "local" | "daytona" | "e2b"

export function WorkspacePicker({ threadId }: WorkspacePickerProps): React.JSX.Element {
  const {
    workspacePath,
    daytonaSandboxId: contextDaytonaSandboxId,
    e2bSandboxId: contextE2bSandboxId,
    setWorkspacePath,
    setDaytonaSandboxId,
    setE2bSandboxId,
    setWorkspaceFiles
  } = useCurrentThread(threadId)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<WorkspaceMode>(
    contextE2bSandboxId
      ? "e2b"
      : contextDaytonaSandboxId
        ? "daytona"
        : "local"
  )

  // Daytona state
  const [hasDaytonaCredentials, setHasDaytonaCredentials] = useState(false)
  const [daytonaSandboxes, setDaytonaSandboxes] = useState<DaytonaSandbox[]>([])
  const [selectedDaytonaSandboxId, setSelectedDaytonaSandboxId] = useState<string | null>(
    contextDaytonaSandboxId
  )
  const [loadingDaytonaSandboxes, setLoadingDaytonaSandboxes] = useState(false)
  const [creatingDaytonaSandbox, setCreatingDaytonaSandbox] = useState(false)

  // E2B state
  const [hasE2BCredentials, setHasE2BCredentials] = useState(false)
  const [e2bSandboxes, setE2bSandboxes] = useState<E2BSandbox[]>([])
  const [selectedE2bSandboxId, setSelectedE2bSandboxId] = useState<string | null>(
    contextE2bSandboxId
  )
  const [loadingE2bSandboxes, setLoadingE2bSandboxes] = useState(false)
  const [creatingE2bSandbox, setCreatingE2bSandbox] = useState(false)

  // Sync local state when context changes (e.g., thread switch)
  useEffect(() => {
    setSelectedDaytonaSandboxId(contextDaytonaSandboxId)
    setSelectedE2bSandboxId(contextE2bSandboxId)
    setMode(
      contextE2bSandboxId
        ? "e2b"
        : contextDaytonaSandboxId
          ? "daytona"
          : "local"
    )
  }, [contextDaytonaSandboxId, contextE2bSandboxId, workspacePath])

  // Load workspace state for current thread
  useEffect(() => {
    async function loadWorkspace(): Promise<void> {
      if (threadId) {
        // Load thread to get metadata
        const thread = await window.api.threads.get(threadId)
        const metadata = (thread?.metadata || {}) as Record<string, unknown>

        // Check if thread uses E2B sandbox
        const e2bId = metadata.e2bSandboxId as string | undefined
        if (e2bId) {
          setSelectedE2bSandboxId(e2bId)
          setE2bSandboxId(e2bId)
          setSelectedDaytonaSandboxId(null)
          setDaytonaSandboxId(null)
          setWorkspacePath(null)
          setMode("e2b")
          return
        }

        // Check if thread uses Daytona sandbox
        const daytonaId = metadata.daytonaSandboxId as string | undefined
        if (daytonaId) {
          setSelectedDaytonaSandboxId(daytonaId)
          setDaytonaSandboxId(daytonaId)
          setSelectedE2bSandboxId(null)
          setE2bSandboxId(null)
          setWorkspacePath(null)
          setMode("daytona")
          return
        }

        // Local workspace
        setSelectedDaytonaSandboxId(null)
        setDaytonaSandboxId(null)
        setSelectedE2bSandboxId(null)
        setE2bSandboxId(null)
        const path = await window.api.workspace.get(threadId)
        setWorkspacePath(path)
        setMode("local")

        // If a folder is linked, load files from disk
        if (path) {
          const result = await window.api.workspace.loadFromDisk(threadId)
          if (result.success && result.files) {
            setWorkspaceFiles(result.files)
          }
        }
      }
    }
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Check credentials and load sandboxes when opening
  useEffect(() => {
    async function checkCredentials(): Promise<void> {
      const hasDaytona = await window.api.daytona.hasCredentials()
      setHasDaytonaCredentials(hasDaytona)

      const hasE2B = await window.api.e2b.hasCredentials()
      setHasE2BCredentials(hasE2B)

      if (open) {
        if (hasDaytona && mode === "daytona") {
          loadDaytonaSandboxes()
        }
        if (hasE2B && mode === "e2b") {
          loadE2bSandboxes()
        }
      }
    }
    checkCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  // Daytona handlers
  async function loadDaytonaSandboxes(): Promise<void> {
    setLoadingDaytonaSandboxes(true)
    try {
      const result = await window.api.daytona.listSandboxes()
      if (!result.error) {
        setDaytonaSandboxes(result.sandboxes)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to load Daytona sandboxes:", e)
    } finally {
      setLoadingDaytonaSandboxes(false)
    }
  }

  async function handleCreateDaytonaSandbox(): Promise<void> {
    setCreatingDaytonaSandbox(true)
    try {
      const result = await window.api.daytona.createSandbox({ language: "typescript" })
      if (result.id) {
        await loadDaytonaSandboxes()
        await handleSelectDaytonaSandbox(result.id)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to create Daytona sandbox:", e)
    } finally {
      setCreatingDaytonaSandbox(false)
    }
  }

  async function handleSelectDaytonaSandbox(sandboxId: string): Promise<void> {
    setSelectedDaytonaSandboxId(sandboxId)
    setSelectedE2bSandboxId(null)
    // Clear local workspace and E2B, set Daytona sandbox in context
    setWorkspacePath(null)
    setDaytonaSandboxId(sandboxId)
    setE2bSandboxId(null)
    // Update thread metadata
    await updateThreadMetadata({
      daytonaSandboxId: sandboxId,
      e2bSandboxId: null,
      workspacePath: "/home/daytona"
    })
    setOpen(false)
  }

  async function handleDeleteDaytonaSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.deleteSandbox(sandboxId)
      await loadDaytonaSandboxes()
      if (selectedDaytonaSandboxId === sandboxId) {
        setSelectedDaytonaSandboxId(null)
        setDaytonaSandboxId(null)
        await updateThreadMetadata({ daytonaSandboxId: null })
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to delete Daytona sandbox:", e)
    }
  }

  async function handleStartDaytonaSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.startSandbox(sandboxId)
      await loadDaytonaSandboxes()
    } catch (e) {
      console.error("[WorkspacePicker] Failed to start Daytona sandbox:", e)
    }
  }

  async function handleStopDaytonaSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.stopSandbox(sandboxId)
      await loadDaytonaSandboxes()
    } catch (e) {
      console.error("[WorkspacePicker] Failed to stop Daytona sandbox:", e)
    }
  }

  // E2B handlers
  async function loadE2bSandboxes(): Promise<void> {
    setLoadingE2bSandboxes(true)
    try {
      const result = await window.api.e2b.listSandboxes()
      if (!result.error) {
        setE2bSandboxes(result.sandboxes)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to load E2B sandboxes:", e)
    } finally {
      setLoadingE2bSandboxes(false)
    }
  }

  async function handleCreateE2bSandbox(): Promise<void> {
    setCreatingE2bSandbox(true)
    try {
      const result = await window.api.e2b.createSandbox({ timeoutMs: 300_000 })
      if (result.sandboxId) {
        await loadE2bSandboxes()
        await handleSelectE2bSandbox(result.sandboxId)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to create E2B sandbox:", e)
    } finally {
      setCreatingE2bSandbox(false)
    }
  }

  async function handleSelectE2bSandbox(sandboxId: string): Promise<void> {
    setSelectedE2bSandboxId(sandboxId)
    setSelectedDaytonaSandboxId(null)
    // Clear local workspace and Daytona, set E2B sandbox in context
    setWorkspacePath(null)
    setDaytonaSandboxId(null)
    setE2bSandboxId(sandboxId)
    // Update thread metadata
    await updateThreadMetadata({
      e2bSandboxId: sandboxId,
      daytonaSandboxId: null,
      workspacePath: "/home/user"
    })
    setOpen(false)
  }

  async function handleKillE2bSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.e2b.killSandbox(sandboxId)
      await loadE2bSandboxes()
      if (selectedE2bSandboxId === sandboxId) {
        setSelectedE2bSandboxId(null)
        setE2bSandboxId(null)
        await updateThreadMetadata({ e2bSandboxId: null })
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to kill E2B sandbox:", e)
    }
  }

  // Local workspace handlers
  async function handleSelectFolder(): Promise<void> {
    await selectWorkspaceFolder(threadId, setWorkspacePath, setWorkspaceFiles, setLoading, setOpen)
    // Clear any sandbox selection from both local state and context
    setSelectedDaytonaSandboxId(null)
    setDaytonaSandboxId(null)
    setSelectedE2bSandboxId(null)
    setE2bSandboxId(null)
    await updateThreadMetadata({ daytonaSandboxId: null, e2bSandboxId: null })
  }

  async function updateThreadMetadata(updates: Record<string, unknown>): Promise<void> {
    try {
      const thread = await window.api.threads.get(threadId)
      if (thread) {
        const metadata = (thread.metadata || {}) as Record<string, unknown>
        await window.api.threads.update(threadId, {
          metadata: { ...metadata, ...updates }
        })
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to update metadata:", e)
    }
  }

  const folderName = workspacePath?.split("/").pop()
  const isConfigured =
    mode === "local" ? !!workspacePath : mode === "daytona" ? !!selectedDaytonaSandboxId : !!selectedE2bSandboxId
  const selectedDaytonaSandbox = daytonaSandboxes.find((s) => s.id === selectedDaytonaSandboxId)
  const selectedE2bSandbox = e2bSandboxes.find((s) => s.sandboxId === selectedE2bSandboxId)

  // Get display text for button
  function getDisplayText(): string {
    if (mode === "e2b" && selectedE2bSandboxId) {
      return `E2B (${selectedE2bSandboxId.slice(0, 8)})`
    }
    if (mode === "daytona" && selectedDaytonaSandboxId) {
      return `Daytona (${selectedDaytonaSandboxId.slice(0, 8)})`
    }
    if (workspacePath) {
      return folderName || "Workspace"
    }
    return "Select workspace"
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs gap-1.5",
            isConfigured ? "text-foreground" : "text-amber-500"
          )}
          disabled={!threadId}
        >
          {mode === "e2b" ? (
            <Box className="size-3.5" />
          ) : mode === "daytona" ? (
            <Cloud className="size-3.5" />
          ) : (
            <Folder className="size-3.5" />
          )}
          <span className="max-w-[120px] truncate">{getDisplayText()}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Mode tabs */}
        <div className="flex border-b border-border">
          <button
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              mode === "local"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode("local")}
          >
            <Folder className="size-3.5 inline mr-1" />
            Local
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              mode === "daytona"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !hasDaytonaCredentials && "opacity-50"
            )}
            onClick={() => {
              setMode("daytona")
              if (hasDaytonaCredentials) loadDaytonaSandboxes()
            }}
            disabled={!hasDaytonaCredentials}
            title={!hasDaytonaCredentials ? "Configure Daytona in Settings" : undefined}
          >
            <Cloud className="size-3.5 inline mr-1" />
            Daytona
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              mode === "e2b"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !hasE2BCredentials && "opacity-50"
            )}
            onClick={() => {
              setMode("e2b")
              if (hasE2BCredentials) loadE2bSandboxes()
            }}
            disabled={!hasE2BCredentials}
            title={!hasE2BCredentials ? "Configure E2B in Settings" : undefined}
          >
            <Box className="size-3.5 inline mr-1" />
            E2B
          </button>
        </div>

        <div className="p-3">
          {mode === "local" ? (
            // Local workspace UI
            <div className="space-y-3">
              {workspacePath ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-md bg-background-secondary border border-border">
                    <Check className="size-3.5 text-status-nominal shrink-0" />
                    <span className="text-sm truncate flex-1" title={workspacePath}>
                      {folderName}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    The agent will read and write files in this folder.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleSelectFolder}
                    disabled={loading}
                  >
                    Change Folder
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Select a folder for the agent to work in. The agent will read and write files
                    directly to this location.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleSelectFolder}
                    disabled={loading}
                  >
                    <Folder className="size-3.5 mr-1.5" />
                    Select Folder
                  </Button>
                </div>
              )}
            </div>
          ) : mode === "daytona" ? (
            // Daytona sandbox UI
            <div className="space-y-3">
              {!hasDaytonaCredentials ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Configure Daytona API key in Settings to use remote sandboxes.
                </p>
              ) : loadingDaytonaSandboxes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Sandbox list */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {daytonaSandboxes.map((sandbox) => (
                      <div
                        key={sandbox.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer transition-colors",
                          selectedDaytonaSandboxId === sandbox.id
                            ? "bg-muted border border-border"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSelectDaytonaSandbox(sandbox.id)}
                      >
                        <div
                          className={cn(
                            "size-2 rounded-full shrink-0",
                            sandbox.state === "started" || sandbox.state === "running"
                              ? "bg-green-500"
                              : sandbox.state === "stopped"
                                ? "bg-yellow-500"
                                : "bg-gray-500"
                          )}
                        />
                        <span className="flex-1 truncate font-mono text-xs">
                          {sandbox.id.slice(0, 12)}...
                        </span>
                        <span className="text-[10px] text-muted-foreground">{sandbox.state}</span>
                        <div className="flex gap-1">
                          {sandbox.state === "stopped" ? (
                            <button
                              className="p-1 hover:bg-muted rounded"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartDaytonaSandbox(sandbox.id)
                              }}
                              title="Start sandbox"
                            >
                              <Play className="size-3" />
                            </button>
                          ) : (
                            <button
                              className="p-1 hover:bg-muted rounded"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStopDaytonaSandbox(sandbox.id)
                              }}
                              title="Stop sandbox"
                            >
                              <Square className="size-3" />
                            </button>
                          )}
                          <button
                            className="p-1 hover:bg-destructive/20 rounded text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteDaytonaSandbox(sandbox.id)
                            }}
                            title="Delete sandbox"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {daytonaSandboxes.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">
                        No sandboxes available
                      </p>
                    )}
                  </div>

                  {/* Create new sandbox button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleCreateDaytonaSandbox}
                    disabled={creatingDaytonaSandbox}
                  >
                    {creatingDaytonaSandbox ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5 mr-1.5" />
                    )}
                    Create Ephemeral Sandbox
                  </Button>

                  <p className="text-[10px] text-muted-foreground leading-relaxed opacity-75">
                    Sandboxes auto-stop after 15 min idle and are deleted when stopped.
                  </p>

                  {selectedDaytonaSandbox && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Using remote Daytona sandbox. Files are stored in /home/daytona.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            // E2B sandbox UI
            <div className="space-y-3">
              {!hasE2BCredentials ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Configure E2B API key in Settings to use remote sandboxes.
                </p>
              ) : loadingE2bSandboxes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Sandbox list */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {e2bSandboxes.map((sandbox) => (
                      <div
                        key={sandbox.sandboxId}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer transition-colors",
                          selectedE2bSandboxId === sandbox.sandboxId
                            ? "bg-muted border border-border"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSelectE2bSandbox(sandbox.sandboxId)}
                      >
                        <div className="size-2 rounded-full shrink-0 bg-green-500" />
                        <span className="flex-1 truncate font-mono text-xs">
                          {sandbox.sandboxId.slice(0, 12)}...
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {sandbox.templateId || "base"}
                        </span>
                        <button
                          className="p-1 hover:bg-destructive/20 rounded text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleKillE2bSandbox(sandbox.sandboxId)
                          }}
                          title="Kill sandbox"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}

                    {e2bSandboxes.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">
                        No sandboxes running
                      </p>
                    )}
                  </div>

                  {/* Create new sandbox button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleCreateE2bSandbox}
                    disabled={creatingE2bSandbox}
                  >
                    {creatingE2bSandbox ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5 mr-1.5" />
                    )}
                    Create Sandbox
                  </Button>

                  <p className="text-[10px] text-muted-foreground leading-relaxed opacity-75">
                    E2B sandboxes run for 5 min by default. Extend timeout as needed.
                  </p>

                  {selectedE2bSandbox && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Using E2B cloud sandbox. Files are stored in /home/user.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
