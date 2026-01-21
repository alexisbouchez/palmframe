import { NextRequest, NextResponse } from "next/server"
import { config, hasE2BCredentials } from "@/server/config"
import { Sandbox } from "e2b"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ sandboxId: string }>
}

// DELETE /api/sandboxes/e2b/:sandboxId - Kill a sandbox
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params

    if (!hasE2BCredentials()) {
      return NextResponse.json(
        { error: "E2B credentials not configured" },
        { status: 400 }
      )
    }

    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: config.sandboxes.e2b.apiKey!
    })

    await sandbox.kill()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to kill E2B sandbox:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to kill sandbox" },
      { status: 500 }
    )
  }
}

// PATCH /api/sandboxes/e2b/:sandboxId - Set timeout
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const body = await request.json()
    const { timeoutMs } = body

    if (!timeoutMs || typeof timeoutMs !== "number") {
      return NextResponse.json(
        { error: "timeoutMs is required and must be a number" },
        { status: 400 }
      )
    }

    if (!hasE2BCredentials()) {
      return NextResponse.json(
        { error: "E2B credentials not configured" },
        { status: 400 }
      )
    }

    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: config.sandboxes.e2b.apiKey!
    })

    await sandbox.setTimeout(timeoutMs)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to update E2B sandbox timeout:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update timeout" },
      { status: 500 }
    )
  }
}
