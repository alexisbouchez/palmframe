import { NextRequest, NextResponse } from "next/server"
import { config, hasE2BCredentials } from "@/server/config"
import { Sandbox } from "e2b"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ sandboxId: string }>
}

// GET /api/sandboxes/e2b/:sandboxId/files - List files in sandbox
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const url = new URL(request.url)
    const path = url.searchParams.get("path") || "/home/user"

    if (!hasE2BCredentials()) {
      return NextResponse.json({
        files: [],
        error: "E2B credentials not configured"
      })
    }

    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: config.sandboxes.e2b.apiKey!
    })

    const entries = await sandbox.files.list(path)

    return NextResponse.json({
      files: entries.map((e) => ({
        path: e.name,
        is_dir: e.type === "dir"
      }))
    })
  } catch (error) {
    console.error("[API] Failed to list E2B files:", error)
    return NextResponse.json({
      files: [],
      error: error instanceof Error ? error.message : "Failed to list files"
    })
  }
}

// POST /api/sandboxes/e2b/:sandboxId/files - Read a file
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const body = await request.json()
    const { path } = body

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
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

    const content = await sandbox.files.read(path, { format: "text" })

    return NextResponse.json({
      content,
      path
    })
  } catch (error) {
    console.error("[API] Failed to read E2B file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read file" },
      { status: 500 }
    )
  }
}
