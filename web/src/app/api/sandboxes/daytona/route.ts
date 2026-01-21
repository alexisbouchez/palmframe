import { NextRequest, NextResponse } from "next/server"
import { config, hasDaytonaCredentials } from "@/server/config"
import { Daytona } from "@daytonaio/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/sandboxes/daytona - List Daytona sandboxes
export async function GET() {
  try {
    if (!hasDaytonaCredentials()) {
      return NextResponse.json({
        sandboxes: [],
        error: "Daytona credentials not configured"
      })
    }

    const client = new Daytona({
      apiKey: config.sandboxes.daytona.apiKey!,
      apiUrl: config.sandboxes.daytona.apiUrl
    })

    const sandboxes = await client.sandbox.list()

    return NextResponse.json({
      sandboxes: sandboxes.map((s) => ({
        id: s.id,
        state: s.state,
        createdAt: s.createdAt,
        labels: s.labels
      }))
    })
  } catch (error) {
    console.error("[API] Failed to list Daytona sandboxes:", error)
    return NextResponse.json({
      sandboxes: [],
      error: error instanceof Error ? error.message : "Failed to list sandboxes"
    })
  }
}

// POST /api/sandboxes/daytona - Create a new Daytona sandbox
export async function POST(request: NextRequest) {
  try {
    if (!hasDaytonaCredentials()) {
      return NextResponse.json(
        { error: "Daytona credentials not configured" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { language = "python", envVars } = body

    const client = new Daytona({
      apiKey: config.sandboxes.daytona.apiKey!,
      apiUrl: config.sandboxes.daytona.apiUrl
    })

    const sandbox = await client.sandbox.create({
      language,
      envVars
    })

    // Wait for sandbox to be running
    await sandbox.start()

    return NextResponse.json({
      id: sandbox.id,
      state: "running"
    })
  } catch (error) {
    console.error("[API] Failed to create Daytona sandbox:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    )
  }
}
