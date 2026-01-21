import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { checkpoints } from "@/server/db/schema"
import { eq, desc, and } from "drizzle-orm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ threadId: string }>
}

// GET /api/threads/:threadId/history - Get checkpoint history
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "50", 10)

    const history = await db
      .select()
      .from(checkpoints)
      .where(and(eq(checkpoints.threadId, threadId), eq(checkpoints.checkpointNs, "")))
      .orderBy(desc(checkpoints.checkpointId))
      .limit(limit)

    // Parse checkpoint data for each entry
    const parsedHistory = history.map((entry) => {
      let checkpoint = null
      let metadata = null

      try {
        checkpoint = JSON.parse(entry.checkpoint)
      } catch {
        // Keep as raw string if not valid JSON
        checkpoint = entry.checkpoint
      }

      try {
        metadata = entry.metadata ? JSON.parse(entry.metadata) : null
      } catch {
        metadata = entry.metadata
      }

      return {
        thread_id: entry.threadId,
        checkpoint_ns: entry.checkpointNs,
        checkpoint_id: entry.checkpointId,
        parent_checkpoint_id: entry.parentCheckpointId,
        checkpoint,
        metadata
      }
    })

    return NextResponse.json(parsedHistory)
  } catch (error) {
    console.error("[API] Failed to get thread history:", error)
    return NextResponse.json({ error: "Failed to get thread history" }, { status: 500 })
  }
}
