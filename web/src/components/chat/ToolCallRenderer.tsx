"use client"

import {
  FileText,
  FolderOpen,
  Search,
  Edit,
  Terminal,
  ListTodo,
  GitBranch,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"

interface ToolCallRendererProps {
  toolCall: ToolCall
  result?: string | unknown
  isError?: boolean
  needsApproval?: boolean
  onApprovalDecision?: (decision: "approve" | "reject" | "edit") => void
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  read_file: FileText,
  write_file: Edit,
  edit_file: Edit,
  ls: FolderOpen,
  glob: FolderOpen,
  grep: Search,
  execute: Terminal,
  write_todos: ListTodo,
  task: GitBranch
}

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read File",
  write_file: "Write File",
  edit_file: "Edit File",
  ls: "List Directory",
  glob: "Find Files",
  grep: "Search Content",
  execute: "Execute Command",
  write_todos: "Update Tasks",
  task: "Subagent Task"
}

export function ToolCallRenderer({
  toolCall,
  result,
  isError,
  needsApproval,
  onApprovalDecision
}: ToolCallRendererProps): React.JSX.Element | null {
  const args = toolCall?.args || {}
  const [isExpanded, setIsExpanded] = useState(false)

  if (!toolCall) return null

  const Icon = TOOL_ICONS[toolCall.name] || Terminal
  const label = TOOL_LABELS[toolCall.name] || toolCall.name

  const handleApprove = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onApprovalDecision?.("approve")
  }

  const handleReject = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onApprovalDecision?.("reject")
  }

  const getDisplayArg = (): string | null => {
    if (!args) return null
    if (args.path) return args.path as string
    if (args.file_path) return args.file_path as string
    if (args.command) return (args.command as string).slice(0, 50)
    if (args.pattern) return args.pattern as string
    if (args.query) return args.query as string
    if (args.glob) return args.glob as string
    return null
  }

  const displayArg = getDisplayArg()

  const renderResult = (): React.ReactNode => {
    if (result === undefined) return null

    if (isError) {
      return (
        <div className="text-xs text-status-critical flex items-start gap-1.5">
          <XCircle className="size-3 mt-0.5 shrink-0" />
          <span className="break-words">
            {typeof result === "string" ? result : JSON.stringify(result)}
          </span>
        </div>
      )
    }

    const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2)

    return (
      <div className="space-y-2">
        <div className="text-xs text-status-nominal flex items-center gap-1.5">
          <CheckCircle2 className="size-3" />
          <span>Completed</span>
        </div>
        {isExpanded && resultStr && (
          <pre className="text-xs font-mono bg-background p-2 rounded-sm overflow-auto max-h-48 whitespace-pre-wrap break-all">
            {resultStr.slice(0, 2000)}
            {resultStr.length > 2000 && "..."}
          </pre>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-sm border overflow-hidden",
        needsApproval
          ? "border-amber-500/50 bg-amber-500/5"
          : "border-border bg-background-elevated"
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-background-interactive transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}

        <Icon
          className={cn("size-4 shrink-0", needsApproval ? "text-amber-500" : "text-status-info")}
        />

        <span className="text-xs font-medium shrink-0">{label}</span>

        {displayArg && (
          <span className="flex-1 truncate text-left text-xs text-muted-foreground font-mono">
            {displayArg}
          </span>
        )}

        {needsApproval && (
          <Badge variant="warning" className="ml-auto shrink-0">
            APPROVAL
          </Badge>
        )}

        {!needsApproval && result === undefined && (
          <Badge variant="outline" className="ml-auto shrink-0 animate-pulse">
            RUNNING
          </Badge>
        )}

        {result !== undefined && !needsApproval && (
          <Badge variant={isError ? "critical" : "nominal"} className="ml-auto shrink-0">
            {isError ? "ERROR" : "OK"}
          </Badge>
        )}
      </button>

      {needsApproval && (
        <div className="border-t border-amber-500/20 px-3 py-3 space-y-3">
          <div>
            <div className="text-section-header text-[10px] mb-1">ARGUMENTS</div>
            <pre className="text-xs font-mono bg-background p-2 rounded-sm overflow-auto max-h-24">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-background-interactive transition-colors"
              onClick={handleReject}
            >
              Reject
            </button>
            <button
              className="px-3 py-1.5 text-xs bg-status-nominal text-background rounded-sm hover:bg-status-nominal/90 transition-colors"
              onClick={handleApprove}
            >
              Approve & Run
            </button>
          </div>
        </div>
      )}

      {!needsApproval && result !== undefined && (
        <div className="border-t border-border px-3 py-2 space-y-2 overflow-hidden">
          {renderResult()}
        </div>
      )}

      {isExpanded && !needsApproval && (
        <div className="border-t border-border px-3 py-2 space-y-2 overflow-hidden">
          <div className="overflow-hidden w-full">
            <div className="text-section-header mb-1">ARGUMENTS</div>
            <pre className="text-xs font-mono bg-background p-2 rounded-sm overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
