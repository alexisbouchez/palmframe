import { NextRequest, NextResponse } from "next/server"
import { HumanMessage } from "@langchain/core/messages"
import { db } from "@/server/db"
import { threads } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { createAgentRuntime } from "@/server/agent/runtime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes max for streaming

/**
 * POST /api/agent/stream - Stream agent responses via Server-Sent Events
 *
 * Request body:
 * - threadId: string - The thread ID
 * - message: string - The user message
 * - modelId?: string - Optional model ID override
 *
 * Returns SSE stream with events:
 * - { type: "stream", mode: "messages" | "values", data: ... }
 * - { type: "done" }
 * - { type: "error", error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { threadId, message, modelId } = await request.json()

    if (!threadId) {
      return NextResponse.json({ error: "Thread ID is required" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Get thread metadata
    const thread = await db.query.threads.findFirst({
      where: eq(threads.threadId, threadId)
    })

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const metadata = (thread.metadata || {}) as {
      daytonaSandboxId?: string
      e2bSandboxId?: string
    }
    const daytonaSandboxId = metadata.daytonaSandboxId
    const e2bSandboxId = metadata.e2bSandboxId

    // Require cloud workspace
    if (!daytonaSandboxId && !e2bSandboxId) {
      return NextResponse.json(
        {
          error: "Cloud workspace required",
          message: "Please select a Daytona or E2B sandbox before sending messages."
        },
        { status: 400 }
      )
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Update thread status to busy
          await db
            .update(threads)
            .set({ status: "busy", updatedAt: new Date() })
            .where(eq(threads.threadId, threadId))

          // Create agent runtime
          const agent = await createAgentRuntime({
            threadId,
            modelId,
            daytonaSandboxId,
            e2bSandboxId
          })

          const humanMessage = new HumanMessage(message)

          // Stream the agent response
          const agentStream = await agent.stream(
            { messages: [humanMessage] },
            {
              configurable: { thread_id: threadId },
              streamMode: ["messages", "values"],
              recursionLimit: 1000
            }
          )

          for await (const chunk of agentStream) {
            // Each chunk is [mode, data] tuple
            const [mode, data] = chunk as [string, unknown]

            const event = {
              type: "stream",
              mode,
              data: JSON.parse(JSON.stringify(data)) // Ensure serializable
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }

          // Send done event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))

          // Update thread status back to idle
          await db
            .update(threads)
            .set({ status: "idle", updatedAt: new Date() })
            .where(eq(threads.threadId, threadId))

          controller.close()
        } catch (error) {
          console.error("[API] Agent stream error:", error)

          // Send error event
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
          )

          // Update thread status to error
          await db
            .update(threads)
            .set({ status: "error", updatedAt: new Date() })
            .where(eq(threads.threadId, threadId))

          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    })
  } catch (error) {
    console.error("[API] Failed to start agent stream:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start agent" },
      { status: 500 }
    )
  }
}
