import { useState, useEffect } from "react"
import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DaytonaCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DaytonaCredentialsDialog({
  open,
  onOpenChange
}: DaytonaCredentialsDialogProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState("")
  const [apiUrl, setApiUrl] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)

  // Load existing credentials when dialog opens
  useEffect(() => {
    if (open) {
      window.api.daytona.getCredentials().then((credentials) => {
        if (credentials) {
          setExistingUrl(credentials.apiUrl)
          setApiUrl(credentials.apiUrl)
        } else {
          setExistingUrl(null)
          setApiUrl("https://app.daytona.io/api")
        }
        // Reset form fields
        setApiKey("")
        setShowKey(false)
      })
    }
  }, [open])

  async function handleSave(): Promise<void> {
    if (!apiKey.trim()) return

    setSaving(true)
    try {
      await window.api.daytona.setCredentials(apiKey.trim(), apiUrl.trim() || undefined)
      onOpenChange(false)
    } catch (e) {
      console.error("[DaytonaCredentials] Failed to save:", e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.daytona.deleteCredentials()
      onOpenChange(false)
    } catch (e) {
      console.error("[DaytonaCredentials] Failed to delete:", e)
    } finally {
      setDeleting(false)
    }
  }

  const hasExisting = existingUrl !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {hasExisting ? "Update Daytona Credentials" : "Configure Daytona"}
          </DialogTitle>
          <DialogDescription>
            {hasExisting
              ? `Currently configured for ${existingUrl}. Enter a new API key to update.`
              : "Enter your Daytona API key to enable remote sandbox execution."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasExisting ? "••••••••••••••••" : "dtn_..."}
                className="pr-10 font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a
                href="https://app.daytona.io/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                app.daytona.io/dashboard/keys
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API URL (optional)</label>
            <Input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://app.daytona.io/api"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leave default unless using a self-hosted Daytona instance
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          {hasExisting ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Remove
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!apiKey.trim() || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
