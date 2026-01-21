import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { threads } from "@/server/db/schema"
import { desc } from "drizzle-orm"
import { v4 as uuid } from "uuid"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/threads - List all threads
export async function GET() {
  try {
    const allThreads = await db.select().from(threads).orderBy(desc(threads.updatedAt))

    // Convert dates to ISO strings for JSON serialization
    const serializedThreads = allThreads.map((thread) => ({
      ...thread,
      created_at: thread.createdAt.toISOString(),
      updated_at: thread.updatedAt.toISOString(),
      thread_id: thread.threadId
    }))

    return NextResponse.json(serializedThreads)
  } catch (error) {
    console.error("[API] Failed to list threads:", error)
    return NextResponse.json({ error: "Failed to list threads" }, { status: 500 })
  }
}

// POST /api/threads - Create new thread
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const threadId = uuid()
    const title = body.title || `Thread ${new Date().toLocaleDateString()}`

    const [newThread] = await db
      .insert(threads)
      .values({
        threadId,
        title,
        metadata: body.metadata || {},
        status: "idle"
      })
      .returning()

    return NextResponse.json({
      ...newThread,
      thread_id: newThread.threadId,
      created_at: newThread.createdAt.toISOString(),
      updated_at: newThread.updatedAt.toISOString()
    })
  } catch (error) {
    console.error("[API] Failed to create thread:", error)
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }
}
