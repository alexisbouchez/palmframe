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

interface E2BCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function E2BCredentialsDialog({
  open,
  onOpenChange
}: E2BCredentialsDialogProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  // Load existing credentials when dialog opens
  useEffect(() => {
    if (open) {
      window.api.e2b.getCredentials().then((credentials) => {
        setHasExisting(credentials?.hasApiKey ?? false)
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
      await window.api.e2b.setCredentials(apiKey.trim())
      onOpenChange(false)
    } catch (e) {
      console.error("[E2BCredentials] Failed to save:", e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.e2b.deleteCredentials()
      onOpenChange(false)
    } catch (e) {
      console.error("[E2BCredentials] Failed to delete:", e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {hasExisting ? "Update E2B Credentials" : "Configure E2B"}
          </DialogTitle>
          <DialogDescription>
            {hasExisting
              ? "API key is configured. Enter a new API key to update."
              : "Enter your E2B API key to enable remote sandbox execution."}
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
                placeholder={hasExisting ? "••••••••••••••••" : "e2b_..."}
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
                href="https://e2b.dev/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                e2b.dev/dashboard
              </a>
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
