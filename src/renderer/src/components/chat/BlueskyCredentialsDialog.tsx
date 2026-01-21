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

interface BlueskyCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BlueskyCredentialsDialog({
  open,
  onOpenChange
}: BlueskyCredentialsDialogProps): React.JSX.Element {
  const [identifier, setIdentifier] = useState("")
  const [appPassword, setAppPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [existingIdentifier, setExistingIdentifier] = useState<string | null>(null)

  // Load existing credentials when dialog opens
  useEffect(() => {
    if (open) {
      window.api.bluesky.getCredentials().then((credentials) => {
        if (credentials) {
          setExistingIdentifier(credentials.identifier)
        } else {
          setExistingIdentifier(null)
        }
        // Reset form fields
        setIdentifier("")
        setAppPassword("")
        setShowPassword(false)
      })
    }
  }, [open])

  async function handleSave(): Promise<void> {
    if (!identifier.trim() || !appPassword.trim()) return

    setSaving(true)
    try {
      await window.api.bluesky.setCredentials(identifier.trim(), appPassword.trim())
      onOpenChange(false)
    } catch (e) {
      console.error("[BlueskyCredentials] Failed to save:", e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.bluesky.deleteCredentials()
      onOpenChange(false)
    } catch (e) {
      console.error("[BlueskyCredentials] Failed to delete:", e)
    } finally {
      setDeleting(false)
    }
  }

  const hasExisting = existingIdentifier !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {hasExisting ? "Update Bluesky Credentials" : "Configure Bluesky"}
          </DialogTitle>
          <DialogDescription>
            {hasExisting
              ? `Currently configured as ${existingIdentifier}. Enter new credentials to update.`
              : "Enter your Bluesky handle and app password to enable social search."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Handle / Email</label>
            <Input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={hasExisting ? (existingIdentifier ?? "") : "yourhandle.bsky.social"}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Your Bluesky handle (e.g., alice.bsky.social) or email address
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">App Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder={hasExisting ? "••••••••••••••••" : "xxxx-xxxx-xxxx-xxxx"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create an app password at{" "}
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                bsky.app/settings/app-passwords
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
            <Button
              type="button"
              onClick={handleSave}
              disabled={!identifier.trim() || !appPassword.trim() || saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
