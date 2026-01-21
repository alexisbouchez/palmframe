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
  Square
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

type WorkspaceMode = "local" | "daytona"

export function WorkspacePicker({ threadId }: WorkspacePickerProps): React.JSX.Element {
  const {
    workspacePath,
    daytonaSandboxId: contextSandboxId,
    setWorkspacePath,
    setDaytonaSandboxId,
    setWorkspaceFiles
  } = useCurrentThread(threadId)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<WorkspaceMode>(contextSandboxId ? "daytona" : "local")

  // Daytona state
  const [hasDaytonaCredentials, setHasDaytonaCredentials] = useState(false)
  const [daytonaSandboxes, setDaytonaSandboxes] = useState<DaytonaSandbox[]>([])
  const [selectedSandboxId, setSelectedSandboxId] = useState<string | null>(contextSandboxId)
  const [loadingSandboxes, setLoadingSandboxes] = useState(false)
  const [creatingSandbox, setCreatingSandbox] = useState(false)

  // Sync local state when context changes (e.g., thread switch)
  useEffect(() => {
    setSelectedSandboxId(contextSandboxId)
    setMode(contextSandboxId ? "daytona" : workspacePath ? "local" : "local")
  }, [contextSandboxId, workspacePath])

  // Load workspace state for current thread
  useEffect(() => {
    async function loadWorkspace(): Promise<void> {
      if (threadId) {
        // Load thread to get metadata
        const thread = await window.api.threads.get(threadId)
        const metadata = (thread?.metadata || {}) as Record<string, unknown>

        // Check if thread uses Daytona sandbox
        const sandboxId = metadata.daytonaSandboxId as string | undefined
        if (sandboxId) {
          setSelectedSandboxId(sandboxId)
          setDaytonaSandboxId(sandboxId)
          setWorkspacePath(null)
          setMode("daytona")
        } else {
          setSelectedSandboxId(null)
          setDaytonaSandboxId(null)
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
    }
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Check Daytona credentials and load sandboxes when opening
  useEffect(() => {
    async function checkDaytona(): Promise<void> {
      const hasCredentials = await window.api.daytona.hasCredentials()
      setHasDaytonaCredentials(hasCredentials)

      if (hasCredentials && open) {
        loadDaytonaSandboxes()
      }
    }
    checkDaytona()
  }, [open])

  async function loadDaytonaSandboxes(): Promise<void> {
    setLoadingSandboxes(true)
    try {
      const result = await window.api.daytona.listSandboxes()
      if (!result.error) {
        setDaytonaSandboxes(result.sandboxes)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to load sandboxes:", e)
    } finally {
      setLoadingSandboxes(false)
    }
  }

  async function handleSelectFolder(): Promise<void> {
    await selectWorkspaceFolder(threadId, setWorkspacePath, setWorkspaceFiles, setLoading, setOpen)
    // Clear any Daytona sandbox selection from both local state and context
    setSelectedSandboxId(null)
    setDaytonaSandboxId(null)
    await updateThreadMetadata({ daytonaSandboxId: null })
  }

  async function handleCreateSandbox(): Promise<void> {
    setCreatingSandbox(true)
    try {
      const result = await window.api.daytona.createSandbox({ language: "typescript" })
      if (result.id) {
        await loadDaytonaSandboxes()
        await handleSelectSandbox(result.id)
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to create sandbox:", e)
    } finally {
      setCreatingSandbox(false)
    }
  }

  async function handleSelectSandbox(sandboxId: string): Promise<void> {
    setSelectedSandboxId(sandboxId)
    // Clear local workspace and set Daytona sandbox in context
    setWorkspacePath(null)
    setDaytonaSandboxId(sandboxId)
    // Update thread metadata (workspacePath in metadata is the remote working directory)
    await updateThreadMetadata({
      daytonaSandboxId: sandboxId,
      workspacePath: "/home/daytona"
    })
    setOpen(false)
  }

  async function handleDeleteSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.deleteSandbox(sandboxId)
      await loadDaytonaSandboxes()
      if (selectedSandboxId === sandboxId) {
        setSelectedSandboxId(null)
        setDaytonaSandboxId(null)
        await updateThreadMetadata({ daytonaSandboxId: null })
      }
    } catch (e) {
      console.error("[WorkspacePicker] Failed to delete sandbox:", e)
    }
  }

  async function handleStartSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.startSandbox(sandboxId)
      await loadDaytonaSandboxes()
    } catch (e) {
      console.error("[WorkspacePicker] Failed to start sandbox:", e)
    }
  }

  async function handleStopSandbox(sandboxId: string): Promise<void> {
    try {
      await window.api.daytona.stopSandbox(sandboxId)
      await loadDaytonaSandboxes()
    } catch (e) {
      console.error("[WorkspacePicker] Failed to stop sandbox:", e)
    }
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
  const isConfigured = mode === "local" ? !!workspacePath : !!selectedSandboxId
  const selectedSandbox = daytonaSandboxes.find((s) => s.id === selectedSandboxId)

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
          {mode === "daytona" ? <Cloud className="size-3.5" /> : <Folder className="size-3.5" />}
          <span className="max-w-[120px] truncate">
            {mode === "daytona" && selectedSandboxId
              ? `Daytona (${selectedSandboxId.slice(0, 8)})`
              : workspacePath
                ? folderName
                : "Select workspace"}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Mode tabs */}
        <div className="flex border-b border-border">
          <button
            className={cn(
              "flex-1 px-4 py-2 text-xs font-medium transition-colors",
              mode === "local"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode("local")}
          >
            <Folder className="size-3.5 inline mr-1.5" />
            Local
          </button>
          <button
            className={cn(
              "flex-1 px-4 py-2 text-xs font-medium transition-colors",
              mode === "daytona"
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
              !hasDaytonaCredentials && "opacity-50"
            )}
            onClick={() => setMode("daytona")}
            disabled={!hasDaytonaCredentials}
            title={!hasDaytonaCredentials ? "Configure Daytona in Settings" : undefined}
          >
            <Cloud className="size-3.5 inline mr-1.5" />
            Daytona
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
          ) : (
            // Daytona sandbox UI
            <div className="space-y-3">
              {!hasDaytonaCredentials ? (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Configure Daytona API key in Settings to use remote sandboxes.
                </p>
              ) : loadingSandboxes ? (
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
                          selectedSandboxId === sandbox.id
                            ? "bg-muted border border-border"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSelectSandbox(sandbox.id)}
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
                                handleStartSandbox(sandbox.id)
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
                                handleStopSandbox(sandbox.id)
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
                              handleDeleteSandbox(sandbox.id)
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
                    onClick={handleCreateSandbox}
                    disabled={creatingSandbox}
                  >
                    {creatingSandbox ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5 mr-1.5" />
                    )}
                    Create Ephemeral Sandbox
                  </Button>

                  <p className="text-[10px] text-muted-foreground leading-relaxed opacity-75">
                    Sandboxes auto-stop after 15 min idle and are deleted when stopped.
                  </p>

                  {selectedSandbox && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Using remote Daytona sandbox. Files are stored in /home/daytona.
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
