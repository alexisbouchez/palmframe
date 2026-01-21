import { NextRequest, NextResponse } from "next/server"
import { config, hasE2BCredentials } from "@/server/config"
import { Sandbox } from "e2b"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/sandboxes/e2b - List E2B sandboxes
export async function GET() {
  try {
    if (!hasE2BCredentials()) {
      return NextResponse.json({
        sandboxes: [],
        error: "E2B credentials not configured"
      })
    }

    const sandboxes: Array<{
      sandboxId: string
      templateId?: string
      startedAt?: Date
      metadata?: Record<string, string>
    }> = []

    // E2B uses pagination via hasNext/nextItems
    const paginator = Sandbox.list({ apiKey: config.sandboxes.e2b.apiKey! })
    while (paginator.hasNext) {
      const items = await paginator.nextItems()
      for (const sandbox of items) {
        sandboxes.push({
          sandboxId: sandbox.sandboxId,
          templateId: sandbox.templateId,
          startedAt: sandbox.startedAt,
          metadata: sandbox.metadata
        })
      }
    }

    return NextResponse.json({
      sandboxes: sandboxes.map((s) => ({
        id: s.sandboxId,
        templateId: s.templateId,
        startedAt: s.startedAt?.toISOString(),
        metadata: s.metadata
      }))
    })
  } catch (error) {
    console.error("[API] Failed to list E2B sandboxes:", error)
    return NextResponse.json({
      sandboxes: [],
      error: error instanceof Error ? error.message : "Failed to list sandboxes"
    })
  }
}

// POST /api/sandboxes/e2b - Create a new E2B sandbox
export async function POST(request: NextRequest) {
  try {
    if (!hasE2BCredentials()) {
      return NextResponse.json(
        { error: "E2B credentials not configured" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { template = "base", timeoutMs = 300000 } = body

    const sandbox = await Sandbox.create(template, {
      apiKey: config.sandboxes.e2b.apiKey!,
      timeoutMs
    })

    return NextResponse.json({
      sandboxId: sandbox.sandboxId,
      templateId: template
    })
  } catch (error) {
    console.error("[API] Failed to create E2B sandbox:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sandbox" },
      { status: 500 }
    )
  }
}
