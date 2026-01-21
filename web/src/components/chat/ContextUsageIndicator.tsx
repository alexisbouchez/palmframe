"use client"

import { CircleGauge, Zap, ArrowDown, ArrowUp, Database } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { TokenUsage } from "@/lib/thread-context"

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "claude-opus-4-5-20251101": 200_000,
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  o1: 200_000,
  "o1-mini": 128_000,
  "gemini-2.5-pro": 2_000_000,
  "gemini-2.5-flash": 1_000_000
}

const DEFAULT_CONTEXT_LIMIT = 128_000

function getContextLimit(modelId: string): number {
  if (MODEL_CONTEXT_LIMITS[modelId]) return MODEL_CONTEXT_LIMITS[modelId]
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (modelId.startsWith(key)) return limit
  }
  if (modelId.includes("claude")) return 200_000
  if (modelId.includes("gpt-4o") || modelId.includes("o1")) return 128_000
  if (modelId.includes("gemini")) return 1_000_000
  return DEFAULT_CONTEXT_LIMIT
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return tokens.toString()
}

function formatTokenCountFull(tokens: number): string {
  return tokens.toLocaleString()
}

interface ContextUsageIndicatorProps {
  tokenUsage: TokenUsage | null
  modelId: string
  className?: string
}

export function ContextUsageIndicator({
  tokenUsage,
  modelId,
  className
}: ContextUsageIndicatorProps): React.JSX.Element | null {
  if (!tokenUsage) return null

  const contextLimit = getContextLimit(modelId)
  const usedTokens = tokenUsage.inputTokens
  const usagePercent = Math.min((usedTokens / contextLimit) * 100, 100)

  let colorClass = "text-blue-500"
  let bgColorClass = "bg-blue-500/20"
  let barColorClass = "bg-blue-500"
  let statusText = "Normal"

  if (usagePercent >= 90) {
    colorClass = "text-red-500"
    bgColorClass = "bg-red-500/20"
    barColorClass = "bg-red-500"
    statusText = "Critical"
  } else if (usagePercent >= 75) {
    colorClass = "text-orange-500"
    bgColorClass = "bg-orange-500/20"
    barColorClass = "bg-orange-500"
    statusText = "Warning"
  } else if (usagePercent >= 50) {
    colorClass = "text-yellow-500"
    bgColorClass = "bg-yellow-500/20"
    barColorClass = "bg-yellow-500"
    statusText = "Moderate"
  }

  const hasCacheData = tokenUsage.cacheReadTokens || tokenUsage.cacheCreationTokens

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs transition-colors hover:opacity-80",
            bgColorClass,
            colorClass,
            className
          )}
        >
          <CircleGauge className="size-3.5" />
          <span className="font-mono">
            {formatTokenCount(usedTokens)} / {formatTokenCount(contextLimit)}
          </span>
          <span className="text-[10px] opacity-70">({usagePercent.toFixed(0)}%)</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-background border-border" align="end" sideOffset={8}>
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Context Window</span>
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                bgColorClass,
                colorClass
              )}
            >
              {statusText}
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColorClass)}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTokenCountFull(usedTokens)} tokens</span>
              <span>{formatTokenCountFull(contextLimit)} max</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Token Breakdown
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUp className="size-3" />
                  <span>Input</span>
                </div>
                <span className="font-mono">{formatTokenCountFull(tokenUsage.inputTokens)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowDown className="size-3" />
                  <span>Output</span>
                </div>
                <span className="font-mono">{formatTokenCountFull(tokenUsage.outputTokens)}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Zap className="size-3" />
                  <span>Total</span>
                </div>
                <span className="font-mono">{formatTokenCountFull(tokenUsage.totalTokens)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Cache
            </div>

            <div className="space-y-1">
              {hasCacheData ? (
                <>
                  {tokenUsage.cacheReadTokens !== undefined && tokenUsage.cacheReadTokens > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-green-500">
                        <Database className="size-3" />
                        <span>Cache hits</span>
                      </div>
                      <span className="font-mono text-green-500">
                        {formatTokenCountFull(tokenUsage.cacheReadTokens)}
                      </span>
                    </div>
                  )}

                  {tokenUsage.cacheCreationTokens !== undefined &&
                    tokenUsage.cacheCreationTokens > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-blue-500">
                          <Database className="size-3" />
                          <span>Cache created</span>
                        </div>
                        <span className="font-mono text-blue-500">
                          {formatTokenCountFull(tokenUsage.cacheCreationTokens)}
                        </span>
                      </div>
                    )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">No cached tokens</div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              Last updated: {tokenUsage.lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
