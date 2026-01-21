"use client"

import { useMemo, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"

type AuthMode = "sign-in" | "sign-up"

export function AuthPanel(): React.JSX.Element {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const displayName = useMemo(() => {
    if (!session?.user) return null
    return session.user.name || session.user.email || "Signed in"
  }, [session])

  const resetForm = (): void => {
    setEmail("")
    setPassword("")
    setName("")
    setErrorMessage(null)
    setIsSubmitting(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0] || "User"
        })
        if (error) {
          setErrorMessage(error.message)
          return
        }
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password
        })
        if (error) {
          setErrorMessage(error.message)
          return
        }
      }

      setOpen(false)
      resetForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed"
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async (): Promise<void> => {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await authClient.signOut()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out"
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (session?.user) {
    return (
      <div className="flex flex-col gap-2 text-xs">
        <div className="truncate text-muted-foreground">Signed in as</div>
        <div className="truncate text-sm font-medium">{displayName}</div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleSignOut}
          disabled={isSubmitting}
        >
          Sign out
        </Button>
        {errorMessage && <div className="text-xs text-status-critical">{errorMessage}</div>}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start" disabled={isPending}>
          Sign in
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "sign-up" ? "Create account" : "Welcome back"}</DialogTitle>
          <DialogDescription>
            {mode === "sign-up"
              ? "Create a Palmframe account to sync your threads."
              : "Sign in to continue your Palmframe session."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete={mode === "sign-up" ? "email" : "username"}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            required
          />
          {errorMessage && <div className="text-xs text-status-critical">{errorMessage}</div>}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
              disabled={isSubmitting}
            >
              {mode === "sign-up" ? "Have an account?" : "Create account"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Working..." : mode === "sign-up" ? "Sign up" : "Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
