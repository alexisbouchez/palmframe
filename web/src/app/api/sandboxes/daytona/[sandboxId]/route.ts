import { NextRequest, NextResponse } from "next/server"
import { config, hasDaytonaCredentials } from "@/server/config"
import { Daytona } from "@daytonaio/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ sandboxId: string }>
}

// DELETE /api/sandboxes/daytona/:sandboxId - Delete a sandbox
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params

    if (!hasDaytonaCredentials()) {
      return NextResponse.json(
        { error: "Daytona credentials not configured" },
        { status: 400 }
      )
    }

    const client = new Daytona({
      apiKey: config.sandboxes.daytona.apiKey!,
      apiUrl: config.sandboxes.daytona.apiUrl
    })

    await client.sandbox.delete(sandboxId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to delete Daytona sandbox:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sandbox" },
      { status: 500 }
    )
  }
}

// PATCH /api/sandboxes/daytona/:sandboxId - Start/Stop a sandbox
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const body = await request.json()
    const { action } = body // "start" or "stop"

    if (!hasDaytonaCredentials()) {
      return NextResponse.json(
        { error: "Daytona credentials not configured" },
        { status: 400 }
      )
    }

    const client = new Daytona({
      apiKey: config.sandboxes.daytona.apiKey!,
      apiUrl: config.sandboxes.daytona.apiUrl
    })

    const sandbox = await client.sandbox.get(sandboxId)

    if (action === "start") {
      await sandbox.start()
    } else if (action === "stop") {
      await sandbox.stop()
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'stop'" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to update Daytona sandbox:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sandbox" },
      { status: 500 }
    )
  }
}
