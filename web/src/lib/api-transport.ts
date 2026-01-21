"use client"

import type { UseStreamTransport } from "@langchain/langgraph-sdk/react"
import type { ToolCall, ToolCallChunk } from "@langchain/core/messages"
import type { Subagent } from "@/types"

/**
 * Stream payload from useStream hook
 */
interface StreamPayload {
  input?: { messages?: Array<{ content: string; type: string }> } | null
  config?: {
    configurable?: {
      thread_id?: string
      model_id?: string
    }
  }
  command?: {
    resume?: { decision: string; editedArgs?: Record<string, unknown> }
  }
  signal?: AbortSignal
}

/**
 * Stream event format expected by useStream
 */
interface StreamEvent {
  event: string
  data: unknown
}

/**
 * API events from SSE stream
 */
interface APIEvent {
  type: "stream" | "done" | "error"
  mode?: "messages" | "values"
  data?: unknown
  error?: string
}

/**
 * Serialized LangGraph message chunk
 */
interface SerializedMessageChunk {
  lc?: number
  type?: string
  id?: string[]
  kwargs?: {
    id?: string
    content?: string | Array<{ type: string; text?: string }>
    tool_calls?: ToolCall[]
    tool_call_chunks?: ToolCallChunk[]
    tool_call_id?: string
    name?: string
    usage_metadata?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }
  }
}

interface MessageMetadata {
  langgraph_node?: string
}

/**
 * HTTP/SSE transport for useStream that uses API routes instead of Electron IPC.
 * Connects to /api/agent/stream endpoint for Server-Sent Events.
 */
export class APITransport implements UseStreamTransport {
  private currentMessageId: string | null = null
  private activeSubagents: Map<string, Subagent> = new Map()
  private abortController: AbortController | null = null

  async stream(payload: StreamPayload): Promise<AsyncGenerator<StreamEvent>> {
    this.currentMessageId = null
    this.activeSubagents.clear()

    const threadId = payload.config?.configurable?.thread_id
    const modelId = payload.config?.configurable?.model_id as string | undefined

    if (!threadId) {
      return this.createErrorGenerator("MISSING_THREAD_ID", "Thread ID is required")
    }

    const hasResumeCommand = payload.command?.resume !== undefined

    const input = payload.input as { messages?: Array<{ content: string; type: string }> } | null
    const messages = input?.messages ?? []
    const lastHumanMessage = messages.find((m) => m.type === "human")
    const messageContent = lastHumanMessage?.content ?? ""

    if (!messageContent && !hasResumeCommand) {
      return this.createErrorGenerator("MISSING_MESSAGE", "Message content is required")
    }

    this.abortController = new AbortController()
    if (payload.signal) {
      payload.signal.addEventListener("abort", () => {
        this.abortController?.abort()
      })
    }

    return this.createStreamGenerator(
      threadId,
      messageContent,
      payload.command,
      this.abortController.signal,
      modelId
    )
  }

  private async *createErrorGenerator(code: string, message: string): AsyncGenerator<StreamEvent> {
    yield {
      event: "error",
      data: { error: code, message }
    }
  }

  private async *createStreamGenerator(
    threadId: string,
    message: string,
    command: unknown,
    signal: AbortSignal,
    modelId?: string
  ): AsyncGenerator<StreamEvent> {
    const runId = crypto.randomUUID()

    // Emit metadata event first
    yield {
      event: "metadata",
      data: { run_id: runId, thread_id: threadId }
    }

    const isResume = !!(command as { resume?: unknown })?.resume
    const endpoint = isResume ? "/api/agent/resume" : "/api/agent/stream"

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message,
          command,
          modelId
        }),
        signal
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        yield {
          event: "error",
          data: { error: "API_ERROR", message: error.message || "Request failed" }
        }
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        yield { event: "error", data: { error: "NO_STREAM", message: "No response stream" } }
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const event = JSON.parse(data) as APIEvent
              const sdkEvents = this.convertToSDKEvents(event, threadId)
              for (const sdkEvent of sdkEvents) {
                yield sdkEvent
                if (sdkEvent.event === "done" || sdkEvent.event === "error") {
                  return
                }
              }
            } catch (e) {
              console.warn("[APITransport] Failed to parse SSE event:", e)
            }
          }
        }
      }

      yield { event: "done", data: { thread_id: threadId } }
    } catch (error) {
      if (signal.aborted) return

      yield {
        event: "error",
        data: {
          error: "STREAM_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      }
    }
  }

  /**
   * Convert API events to LangGraph SDK format
   */
  private convertToSDKEvents(event: APIEvent, threadId: string): StreamEvent[] {
    const events: StreamEvent[] = []

    switch (event.type) {
      case "stream": {
        const streamEvents = this.processStreamEvent(event)
        events.push(...streamEvents)
        break
      }

      case "done":
        events.push({
          event: "done",
          data: { thread_id: threadId }
        })
        break

      case "error":
        events.push({
          event: "error",
          data: { error: "STREAM_ERROR", message: event.error }
        })
        break
    }

    return events
  }

  /**
   * Process raw LangGraph stream events (mode + data tuples)
   */
  private processStreamEvent(event: APIEvent): StreamEvent[] {
    const events: StreamEvent[] = []
    const { mode, data } = event

    if (mode === "messages" && Array.isArray(data)) {
      const [msgChunk, metadata] = data as [SerializedMessageChunk, MessageMetadata]

      const kwargs = msgChunk?.kwargs || {}
      const classId = Array.isArray(msgChunk?.id) ? msgChunk.id : []
      const className = classId[classId.length - 1] || ""

      const isToolMessage = className.includes("ToolMessage") && !!kwargs.tool_call_id
      const isAIMessage = className.includes("AI") || className.includes("AIMessageChunk")

      if (isAIMessage) {
        const content = this.extractContent(kwargs.content)
        const msgId = kwargs.id || this.currentMessageId || crypto.randomUUID()
        this.currentMessageId = msgId

        if (content || kwargs.tool_calls?.length) {
          events.push({
            event: "messages",
            data: [
              {
                id: msgId,
                type: "ai",
                content: content || "",
                ...(kwargs.tool_calls?.length && { tool_calls: kwargs.tool_calls })
              },
              { langgraph_node: metadata?.langgraph_node || "agent" }
            ]
          })
        }

        // Handle tool call chunks
        if (kwargs.tool_call_chunks?.length) {
          const subagentEvents = this.processToolCallChunks(kwargs.tool_call_chunks)
          events.push(...subagentEvents)
        }

        // Handle complete tool calls
        if (kwargs.tool_calls?.length) {
          const subagentEvents = this.processCompletedToolCalls(kwargs.tool_calls)
          events.push(...subagentEvents)
        }

        // Extract usage metadata
        const usageMetadata = kwargs.usage_metadata
        if (usageMetadata?.input_tokens !== undefined && usageMetadata.input_tokens > 0) {
          events.push({
            event: "custom",
            data: {
              type: "token_usage",
              usage: {
                inputTokens: usageMetadata.input_tokens,
                outputTokens: usageMetadata.output_tokens,
                totalTokens: usageMetadata.total_tokens
              }
            }
          })
        }
      }

      if (isToolMessage) {
        events.push({
          event: "messages",
          data: [
            {
              id: kwargs.id || crypto.randomUUID(),
              type: "tool",
              tool_call_id: kwargs.tool_call_id,
              name: kwargs.name,
              content: this.extractContent(kwargs.content)
            },
            { langgraph_node: metadata?.langgraph_node || "tools" }
          ]
        })
      }
    }

    if (mode === "values" && data && typeof data === "object") {
      const valuesData = data as {
        todos?: unknown[]
        files?: unknown
        workspacePath?: string
        subagents?: unknown[]
        interrupt?: unknown
      }

      if (valuesData.todos !== undefined) {
        events.push({
          event: "values",
          data: { todos: valuesData.todos }
        })
      }

      if (valuesData.subagents?.length) {
        events.push({
          event: "custom",
          data: { type: "subagents", subagents: valuesData.subagents }
        })
      }

      if (valuesData.interrupt) {
        // Handle HITL interrupt
        const interrupt = valuesData.interrupt as
          | Array<{ value?: { actionRequests?: unknown[]; reviewConfigs?: unknown[] } }>
          | { id?: string; tool_call?: unknown }

        if (Array.isArray(interrupt) && interrupt.length > 0) {
          const interruptValue = interrupt[0]?.value
          const actionRequests = interruptValue?.actionRequests as
            | Array<{ id: string; name: string; args: unknown }>
            | undefined
          const reviewConfigs = interruptValue?.reviewConfigs as
            | Array<{ actionName: string; allowedDecisions: string[] }>
            | undefined

          if (actionRequests?.length) {
            const firstAction = actionRequests[0]
            const reviewConfig = reviewConfigs?.find((rc) => rc.actionName === firstAction.name)

            events.push({
              event: "custom",
              data: {
                type: "interrupt",
                request: {
                  id: firstAction.id || crypto.randomUUID(),
                  tool_call: {
                    id: firstAction.id,
                    name: firstAction.name,
                    args: firstAction.args || {}
                  },
                  allowed_decisions: reviewConfig?.allowedDecisions || [
                    "approve",
                    "reject",
                    "edit"
                  ]
                }
              }
            })
          }
        } else if ("tool_call" in interrupt && interrupt.tool_call) {
          events.push({
            event: "custom",
            data: {
              type: "interrupt",
              request: {
                id: interrupt.id || crypto.randomUUID(),
                tool_call: interrupt.tool_call,
                allowed_decisions: ["approve", "reject", "edit"]
              }
            }
          })
        }
      }
    }

    return events
  }

  private extractContent(content: string | Array<{ type: string; text?: string }> | undefined): string {
    if (!content) return ""
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("")
    }
    return ""
  }

  private processToolCallChunks(chunks: ToolCallChunk[]): StreamEvent[] {
    const events: StreamEvent[] = []

    for (const chunk of chunks) {
      if (chunk.name === "task") {
        const taskId = chunk.id || crypto.randomUUID()
        if (!this.activeSubagents.has(taskId)) {
          this.activeSubagents.set(taskId, {
            id: taskId,
            name: "Subagent",
            description: "Processing...",
            status: "running",
            startedAt: new Date(),
            toolCallId: chunk.id
          })

          events.push({
            event: "custom",
            data: {
              type: "subagents",
              subagents: Array.from(this.activeSubagents.values())
            }
          })
        }
      }
    }

    return events
  }

  private processCompletedToolCalls(toolCalls: ToolCall[]): StreamEvent[] {
    const events: StreamEvent[] = []

    for (const tc of toolCalls) {
      if (tc.name === "task" && tc.id) {
        const args = tc.args as { description?: string; subagent_type?: string }
        const description = args?.description || "Subagent task"
        const subagentType = args?.subagent_type

        this.activeSubagents.set(tc.id, {
          id: tc.id,
          name: description.slice(0, 50),
          description,
          status: "running",
          startedAt: new Date(),
          toolCallId: tc.id,
          subagentType
        })

        events.push({
          event: "custom",
          data: {
            type: "subagents",
            subagents: Array.from(this.activeSubagents.values())
          }
        })
      }
    }

    return events
  }

  stop(): void {
    this.abortController?.abort()
  }
}
