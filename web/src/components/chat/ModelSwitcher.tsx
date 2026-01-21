"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Check, AlertCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { useCurrentThread } from "@/lib/thread-context"
import { cn } from "@/lib/utils"
import type { Provider, ProviderId } from "@/types"

function AnthropicIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zm-10.608 0L0 20.459h3.744l1.368-3.562h7.044l1.368 3.562h3.744L10.608 3.541H6.696zm.576 10.852l2.352-6.122 2.352 6.122H7.272z" />
    </svg>
  )
}

function OpenAIIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" />
    </svg>
  )
}

function GoogleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
    </svg>
  )
}

function MistralIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 3h4v4H3V3zm7 0h4v4h-4V3zm7 0h4v4h-4V3zM3 10h4v4H3v-4zm14 0h4v4h-4v-4zM3 17h4v4H3v-4zm7 0h4v4h-4v-4zm7 0h4v4h-4v-4zm-7-7h4v4h-4v-4z" />
    </svg>
  )
}

const PROVIDER_ICONS: Record<ProviderId, React.FC<{ className?: string }>> = {
  anthropic: AnthropicIcon,
  openai: OpenAIIcon,
  google: GoogleIcon,
  mistral: MistralIcon,
  ollama: () => null
}

const FALLBACK_PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic", hasApiKey: false },
  { id: "openai", name: "OpenAI", hasApiKey: false },
  { id: "google", name: "Google", hasApiKey: false },
  { id: "mistral", name: "Mistral", hasApiKey: false }
]

interface ModelSwitcherProps {
  threadId: string
}

export function ModelSwitcher({ threadId }: ModelSwitcherProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | null>(null)

  const { models, providers, loadModels, loadProviders } = useAppStore()
  const { currentModel, setCurrentModel } = useCurrentThread(threadId)

  useEffect(() => {
    loadModels()
    loadProviders()
  }, [loadModels, loadProviders])

  const displayProviders = providers.length > 0 ? providers : FALLBACK_PROVIDERS

  const effectiveProviderId =
    selectedProviderId ||
    (currentModel ? models.find((m) => m.id === currentModel)?.provider : null) ||
    (displayProviders.length > 0 ? displayProviders[0].id : null)

  const selectedModel = models.find((m) => m.id === currentModel)
  const filteredModels = effectiveProviderId
    ? models.filter((m) => m.provider === effectiveProviderId)
    : []
  const selectedProvider = displayProviders.find((p) => p.id === effectiveProviderId)

  function handleProviderClick(provider: Provider): void {
    setSelectedProviderId(provider.id)
  }

  function handleModelSelect(modelId: string): void {
    setCurrentModel(modelId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {selectedModel ? (
            <>
              {PROVIDER_ICONS[selectedModel.provider]?.({ className: "size-3.5" })}
              <span className="font-mono">{selectedModel.id}</span>
            </>
          ) : (
            <span>Select model</span>
          )}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0 bg-background border-border"
        align="start"
        sideOffset={8}
      >
        <div className="flex min-h-[240px]">
          <div className="w-[140px] border-r border-border p-2 bg-muted/30">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Provider
            </div>
            <div className="space-y-0.5">
              {displayProviders.map((provider) => {
                const Icon = PROVIDER_ICONS[provider.id]
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderClick(provider)}
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs transition-colors text-left",
                      effectiveProviderId === provider.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {Icon && <Icon className="size-3.5 shrink-0" />}
                    <span className="flex-1 truncate">{provider.name}</span>
                    {!provider.hasApiKey && (
                      <AlertCircle className="size-3 text-status-warning shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 p-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Model
            </div>

            {selectedProvider && !selectedProvider.hasApiKey ? (
              <div className="flex flex-col items-center justify-center h-[180px] px-4 text-center">
                <AlertCircle className="size-6 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  API key required for {selectedProvider.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure via environment variables
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-[200px]">
                <div className="overflow-y-auto flex-1 space-y-0.5">
                  {filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs transition-colors text-left font-mono",
                        currentModel === model.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className="flex-1 truncate">{model.id}</span>
                      {currentModel === model.id && (
                        <Check className="size-3.5 shrink-0 text-foreground" />
                      )}
                    </button>
                  ))}

                  {filteredModels.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-4">No models available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
