import { useState } from "react"
import { Plus, MessageSquare, Trash2, Pencil, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAppStore } from "@/lib/store"
import { useThreadStream } from "@/lib/thread-context"
import { cn, formatRelativeTime, truncate } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu"
import { BlueskyCredentialsDialog } from "@/components/chat/BlueskyCredentialsDialog"
import { DaytonaCredentialsDialog } from "@/components/chat/DaytonaCredentialsDialog"
import { E2BCredentialsDialog } from "@/components/chat/E2BCredentialsDialog"
import type { Thread } from "@/types"

// Bluesky icon component
function BlueskyIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 568 501" fill="currentColor">
      <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.093 192.775 552.138 219.025C540.497 270.257 501.917 282.728 467.025 277.265C406.648 268.012 343.168 233.003 318.666 278.75C295.12 322.751 341.016 373.879 381.393 410.169C407.894 433.773 436.207 451.063 436.207 474.178C436.207 499.278 404.85 500.956 394.406 499.934C308.539 491.373 283.899 422.107 284 346.839C284.101 422.107 259.46 491.373 173.594 499.934C163.15 500.956 131.793 499.278 131.793 474.178C131.793 451.063 160.106 433.773 186.607 410.169C226.984 373.879 272.88 322.751 249.334 278.75C224.832 233.003 161.352 268.012 100.975 277.265C66.0831 282.728 27.5034 270.257 15.8619 219.025C9.90685 192.775 0 75.2916 0 57.9464C0 -28.9064 76.1349 -1.61183 123.121 33.6637Z" />
    </svg>
  )
}

// Daytona icon component
function DaytonaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

// E2B icon component (box/cube shape)
function E2BIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

// Thread loading indicator that subscribes to the stream context
function ThreadLoadingIcon({ threadId }: { threadId: string }): React.JSX.Element {
  const { isLoading } = useThreadStream(threadId)

  if (isLoading) {
    return <Loader2 className="size-4 shrink-0 text-status-info animate-spin" />
  }
  return <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
}

// Individual thread list item component
function ThreadListItem({
  thread,
  isSelected,
  isEditing,
  editingTitle,
  onSelect,
  onDelete,
  onStartEditing,
  onSaveTitle,
  onCancelEditing,
  onEditingTitleChange
}: {
  thread: Thread
  isSelected: boolean
  isEditing: boolean
  editingTitle: string
  onSelect: () => void
  onDelete: () => void
  onStartEditing: () => void
  onSaveTitle: () => void
  onCancelEditing: () => void
  onEditingTitleChange: (value: string) => void
}): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-sm px-3 py-2 cursor-pointer transition-colors overflow-hidden",
            isSelected
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50"
          )}
          onClick={() => {
            if (!isEditing) {
              onSelect()
            }
          }}
        >
          <ThreadLoadingIcon threadId={thread.thread_id} />
          <div className="flex-1 min-w-0 overflow-hidden">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => onEditingTitleChange(e.target.value)}
                onBlur={onSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveTitle()
                  if (e.key === "Escape") onCancelEditing()
                }}
                className="w-full bg-background border border-border rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="text-sm truncate block">
                  {thread.title || truncate(thread.thread_id, 20)}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {formatRelativeTime(thread.updated_at)}
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onStartEditing}>
          <Pencil className="size-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ThreadSidebar(): React.JSX.Element {
  const { threads, currentThreadId, createThread, selectThread, deleteThread, updateThread } =
    useAppStore()

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [blueskyDialogOpen, setBlueskyDialogOpen] = useState(false)
  const [daytonaDialogOpen, setDaytonaDialogOpen] = useState(false)
  const [e2bDialogOpen, setE2bDialogOpen] = useState(false)

  const startEditing = (threadId: string, currentTitle: string): void => {
    setEditingThreadId(threadId)
    setEditingTitle(currentTitle || "")
  }

  const saveTitle = async (): Promise<void> => {
    if (editingThreadId && editingTitle.trim()) {
      await updateThread(editingThreadId, { title: editingTitle.trim() })
    }
    setEditingThreadId(null)
    setEditingTitle("")
  }

  const cancelEditing = (): void => {
    setEditingThreadId(null)
    setEditingTitle("")
  }

  const handleNewThread = async (): Promise<void> => {
    await createThread({ title: `Thread ${new Date().toLocaleDateString()}` })
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-sidebar overflow-hidden">
      {/* New Thread Button - with dynamic safe area padding when zoomed out */}
      <div className="p-2" style={{ paddingTop: "calc(8px + var(--sidebar-safe-padding, 0px))" }}>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleNewThread}
        >
          <Plus className="size-4" />
          New Thread
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1 overflow-hidden">
          {threads.map((thread) => (
            <ThreadListItem
              key={thread.thread_id}
              thread={thread}
              isSelected={currentThreadId === thread.thread_id}
              isEditing={editingThreadId === thread.thread_id}
              editingTitle={editingTitle}
              onSelect={() => selectThread(thread.thread_id)}
              onDelete={() => deleteThread(thread.thread_id)}
              onStartEditing={() => startEditing(thread.thread_id, thread.title || "")}
              onSaveTitle={saveTitle}
              onCancelEditing={cancelEditing}
              onEditingTitleChange={setEditingTitle}
            />
          ))}

          {threads.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No threads yet
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Settings */}
      <div className="p-2 border-t border-border">
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Settings className="size-4" />
              Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start" side="right">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Integrations
            </div>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left hover:bg-muted transition-colors"
              onClick={() => {
                setSettingsOpen(false)
                setBlueskyDialogOpen(true)
              }}
            >
              <BlueskyIcon className="size-4" />
              <span>Bluesky</span>
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left hover:bg-muted transition-colors"
              onClick={() => {
                setSettingsOpen(false)
                setDaytonaDialogOpen(true)
              }}
            >
              <DaytonaIcon className="size-4" />
              <span>Daytona</span>
            </button>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-left hover:bg-muted transition-colors"
              onClick={() => {
                setSettingsOpen(false)
                setE2bDialogOpen(true)
              }}
            >
              <E2BIcon className="size-4" />
              <span>E2B</span>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <BlueskyCredentialsDialog open={blueskyDialogOpen} onOpenChange={setBlueskyDialogOpen} />
      <DaytonaCredentialsDialog open={daytonaDialogOpen} onOpenChange={setDaytonaDialogOpen} />
      <E2BCredentialsDialog open={e2bDialogOpen} onOpenChange={setE2bDialogOpen} />
    </aside>
  )
}
