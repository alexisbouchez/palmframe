import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { threads, checkpoints, writes } from "@/server/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ threadId: string }>
}

// GET /api/threads/:threadId
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params

    const thread = await db.query.threads.findFirst({
      where: eq(threads.threadId, threadId)
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...thread,
      thread_id: thread.threadId,
      created_at: thread.createdAt.toISOString(),
      updated_at: thread.updatedAt.toISOString()
    })
  } catch (error) {
    console.error("[API] Failed to get thread:", error)
    return NextResponse.json({ error: "Failed to get thread" }, { status: 500 })
  }
}

// PATCH /api/threads/:threadId
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params
    const updates = await request.json()

    // Build update object - only include fields that are provided
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    if (updates.threadValues !== undefined) updateData.threadValues = updates.threadValues
    if (updates.thread_values !== undefined) updateData.threadValues = updates.thread_values

    const [updated] = await db
      .update(threads)
      .set(updateData)
      .where(eq(threads.threadId, threadId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...updated,
      thread_id: updated.threadId,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString()
    })
  } catch (error) {
    console.error("[API] Failed to update thread:", error)
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 })
  }
}

// DELETE /api/threads/:threadId
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params

    // Delete checkpoints and writes first (cascade should handle this, but be explicit)
    await db.delete(checkpoints).where(eq(checkpoints.threadId, threadId))
    await db.delete(writes).where(eq(writes.threadId, threadId))
    await db.delete(threads).where(eq(threads.threadId, threadId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to delete thread:", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}
