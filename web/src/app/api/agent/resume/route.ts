import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { threads } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { createAgentRuntime } from "@/server/agent/runtime"
import { Command } from "@langchain/langgraph"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/agent/resume - Resume agent after HITL interrupt
 *
 * Request body:
 * - threadId: string - The thread ID
 * - command: { resume: { decision: "approve" | "reject" | "edit" } }
 * - modelId?: string - Optional model ID override
 *
 * Returns SSE stream with same format as /api/agent/stream
 */
export async function POST(request: NextRequest) {
  try {
    const { threadId, command, modelId } = await request.json()

    if (!threadId) {
      return NextResponse.json({ error: "Thread ID is required" }, { status: 400 })
    }

    if (!command?.resume?.decision) {
      return NextResponse.json({ error: "Resume command with decision is required" }, { status: 400 })
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

    if (!daytonaSandboxId && !e2bSandboxId) {
      return NextResponse.json(
        {
          error: "Cloud workspace required",
          message: "Please select a Daytona or E2B sandbox."
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

          // Create the resume command
          const decision = command.resume.decision as "approve" | "reject" | "edit"

          // For approve, we send null input with the resume command
          // For reject, we can optionally provide feedback
          const resumeInput =
            decision === "approve"
              ? null
              : decision === "reject"
                ? { messages: [] } // Empty to indicate rejection
                : command.resume.editedArgs
                  ? { edited_args: command.resume.editedArgs }
                  : null

          // Use Command to resume from interrupt
          const resumeCommand = new Command({
            resume: decision === "approve" ? true : { decision }
          })

          // Stream the resumed agent response
          const agentStream = await agent.stream(resumeInput, {
            configurable: { thread_id: threadId },
            streamMode: ["messages", "values"],
            recursionLimit: 1000,
            ...resumeCommand
          })

          for await (const chunk of agentStream) {
            const [mode, data] = chunk as [string, unknown]

            const event = {
              type: "stream",
              mode,
              data: JSON.parse(JSON.stringify(data))
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))

          await db
            .update(threads)
            .set({ status: "idle", updatedAt: new Date() })
            .where(eq(threads.threadId, threadId))

          controller.close()
        } catch (error) {
          console.error("[API] Agent resume error:", error)

          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
          )

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
    console.error("[API] Failed to resume agent:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resume agent" },
      { status: 500 }
    )
  }
}
