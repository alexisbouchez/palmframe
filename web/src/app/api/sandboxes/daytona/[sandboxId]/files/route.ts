import { NextRequest, NextResponse } from "next/server"
import { config, hasDaytonaCredentials } from "@/server/config"
import { Daytona } from "@daytonaio/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ sandboxId: string }>
}

// GET /api/sandboxes/daytona/:sandboxId/files - List files in sandbox
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const url = new URL(request.url)
    const path = url.searchParams.get("path") || "/home/daytona"

    if (!hasDaytonaCredentials()) {
      return NextResponse.json({
        files: [],
        error: "Daytona credentials not configured"
      })
    }

    const client = new Daytona({
      apiKey: config.sandboxes.daytona.apiKey!,
      apiUrl: config.sandboxes.daytona.apiUrl
    })

    const sandbox = await client.sandbox.get(sandboxId)
    const files = await sandbox.fs.listDir(path)

    return NextResponse.json({
      files: files.map((f) => ({
        path: f.name,
        is_dir: f.isDir,
        size: f.size,
        modified_at: f.modTime
      }))
    })
  } catch (error) {
    console.error("[API] Failed to list Daytona files:", error)
    return NextResponse.json({
      files: [],
      error: error instanceof Error ? error.message : "Failed to list files"
    })
  }
}

// POST /api/sandboxes/daytona/:sandboxId/files - Read a file
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sandboxId } = await params
    const body = await request.json()
    const { path } = body

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

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
    const content = await sandbox.fs.downloadFile(path)

    // Convert to string if it's a buffer/uint8array
    const textContent =
      typeof content === "string"
        ? content
        : new TextDecoder().decode(content as Uint8Array)

    return NextResponse.json({
      content: textContent,
      path
    })
  } catch (error) {
    console.error("[API] Failed to read Daytona file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read file" },
      { status: 500 }
    )
  }
}
