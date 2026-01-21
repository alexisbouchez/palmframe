"use client"

import { useState, useEffect } from "react"
import { Cloud, Box, ChevronDown, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCurrentThread } from "@/lib/thread-context"
import { cn } from "@/lib/utils"

interface Sandbox {
  id: string
  name?: string
  state?: string
  createdAt?: string
}

interface WorkspacePickerProps {
  threadId: string
}

export function WorkspacePicker({ threadId }: WorkspacePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [daytonaSandboxes, setDaytonaSandboxes] = useState<Sandbox[]>([])
  const [e2bSandboxes, setE2bSandboxes] = useState<Sandbox[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)

  const { daytonaSandboxId, e2bSandboxId, setDaytonaSandboxId, setE2bSandboxId } =
    useCurrentThread(threadId)

  // Load sandboxes when popover opens
  useEffect(() => {
    if (open) {
      loadSandboxes()
    }
  }, [open])

  const loadSandboxes = async () => {
    setLoading(true)
    try {
      const [daytonaRes, e2bRes] = await Promise.all([
        fetch("/api/sandboxes/daytona").catch(() => null),
        fetch("/api/sandboxes/e2b").catch(() => null)
      ])

      if (daytonaRes?.ok) {
        const data = await daytonaRes.json()
        setDaytonaSandboxes(data.sandboxes || [])
      }

      if (e2bRes?.ok) {
        const data = await e2bRes.json()
        setE2bSandboxes(data.sandboxes || [])
      }
    } catch (error) {
      console.error("[WorkspacePicker] Failed to load sandboxes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDaytona = async (sandbox: Sandbox) => {
    setDaytonaSandboxId(sandbox.id)
    setE2bSandboxId(null)

    // Persist to thread metadata
    try {
      await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { daytonaSandboxId: sandbox.id, e2bSandboxId: null }
        })
      })
    } catch (error) {
      console.error("[WorkspacePicker] Failed to persist sandbox:", error)
    }

    setOpen(false)
  }

  const handleSelectE2B = async (sandbox: Sandbox) => {
    setE2bSandboxId(sandbox.id)
    setDaytonaSandboxId(null)

    // Persist to thread metadata
    try {
      await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { e2bSandboxId: sandbox.id, daytonaSandboxId: null }
        })
      })
    } catch (error) {
      console.error("[WorkspacePicker] Failed to persist sandbox:", error)
    }

    setOpen(false)
  }

  const handleCreateDaytona = async () => {
    setCreating("daytona")
    try {
      const response = await fetch("/api/sandboxes/daytona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      if (response.ok) {
        const sandbox = await response.json()
        await handleSelectDaytona(sandbox)
        await loadSandboxes()
      }
    } catch (error) {
      console.error("[WorkspacePicker] Failed to create Daytona sandbox:", error)
    } finally {
      setCreating(null)
    }
  }

  const handleCreateE2B = async () => {
    setCreating("e2b")
    try {
      const response = await fetch("/api/sandboxes/e2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
      if (response.ok) {
        const sandbox = await response.json()
        await handleSelectE2B(sandbox)
        await loadSandboxes()
      }
    } catch (error) {
      console.error("[WorkspacePicker] Failed to create E2B sandbox:", error)
    } finally {
      setCreating(null)
    }
  }

  const getCurrentLabel = (): string => {
    if (e2bSandboxId) return `E2B: ${e2bSandboxId.slice(0, 8)}...`
    if (daytonaSandboxId) return `Daytona: ${daytonaSandboxId.slice(0, 8)}...`
    return "Select sandbox"
  }

  const hasWorkspace = !!daytonaSandboxId || !!e2bSandboxId

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs",
            hasWorkspace ? "text-muted-foreground hover:text-foreground" : "text-amber-500"
          )}
        >
          <Cloud className="size-3.5" />
          <span className="max-w-[120px] truncate">{getCurrentLabel()}</span>
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-background border-border" align="start" sideOffset={8}>
        <div className="p-3 space-y-3">
          <div className="text-xs font-medium text-foreground">Cloud Sandbox</div>
          <p className="text-xs text-muted-foreground">
            Select or create a cloud sandbox for the agent to work in.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Daytona Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Daytona</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleCreateDaytona}
                    disabled={!!creating}
                  >
                    {creating === "daytona" ? (
                      <Loader2 className="size-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="size-3 mr-1" />
                    )}
                    New
                  </Button>
                </div>
                {daytonaSandboxes.length > 0 ? (
                  <div className="space-y-1">
                    {daytonaSandboxes.map((sandbox) => (
                      <button
                        key={sandbox.id}
                        onClick={() => handleSelectDaytona(sandbox)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs transition-colors text-left",
                          daytonaSandboxId === sandbox.id
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Box className="size-3.5 shrink-0" />
                        <span className="flex-1 truncate font-mono">
                          {sandbox.name || sandbox.id.slice(0, 12)}
                        </span>
                        {sandbox.state && (
                          <span
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded",
                              sandbox.state === "running"
                                ? "bg-status-nominal/20 text-status-nominal"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {sandbox.state}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground px-2 py-1">No Daytona sandboxes</p>
                )}
              </div>

              {/* E2B Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">E2B</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleCreateE2B}
                    disabled={!!creating}
                  >
                    {creating === "e2b" ? (
                      <Loader2 className="size-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="size-3 mr-1" />
                    )}
                    New
                  </Button>
                </div>
                {e2bSandboxes.length > 0 ? (
                  <div className="space-y-1">
                    {e2bSandboxes.map((sandbox) => (
                      <button
                        key={sandbox.id}
                        onClick={() => handleSelectE2B(sandbox)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs transition-colors text-left",
                          e2bSandboxId === sandbox.id
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Box className="size-3.5 shrink-0" />
                        <span className="flex-1 truncate font-mono">
                          {sandbox.name || sandbox.id.slice(0, 12)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground px-2 py-1">No E2B sandboxes</p>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
