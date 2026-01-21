// Thread and run types
export type ThreadStatus = "idle" | "busy" | "interrupted" | "error"

export interface Thread {
  thread_id: string
  created_at: Date
  updated_at: Date
  metadata?: Record<string, unknown>
  status: ThreadStatus
  thread_values?: Record<string, unknown>
  title?: string
}

export type RunStatus = "pending" | "running" | "error" | "success" | "interrupted"

export interface Run {
  run_id: string
  thread_id: string
  assistant_id?: string
  created_at: Date
  updated_at: Date
  status: RunStatus
  metadata?: Record<string, unknown>
}

// Provider configuration
export type ProviderId = "anthropic" | "openai" | "google" | "mistral" | "ollama"

export interface Provider {
  id: ProviderId
  name: string
  hasApiKey: boolean
}

export interface ModelConfig {
  id: string
  name: string
  provider: ProviderId
  model: string
  description?: string
  available: boolean
}

// Subagent types
export interface Subagent {
  id: string
  name: string
  description: string
  status: "pending" | "running" | "completed" | "failed"
  startedAt?: Date
  completedAt?: Date
  toolCallId?: string
  subagentType?: string
}

// Message types
export interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string | ContentBlock[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
  created_at: Date
}

export interface ContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result"
  text?: string
  tool_use_id?: string
  name?: string
  input?: unknown
  content?: string
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  tool_call_id: string
  content: string | unknown
  is_error?: boolean
}

// Human-in-the-loop types
export interface HITLRequest {
  id: string
  tool_call: ToolCall
  allowed_decisions: HITLDecision["type"][]
}

export interface HITLDecision {
  type: "approve" | "reject" | "edit"
  tool_call_id: string
  edited_args?: Record<string, unknown>
  feedback?: string
}

// Todo and file types
export interface Todo {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

export interface FileInfo {
  path: string
  is_dir?: boolean
  size?: number
  modified_at?: string
}

export interface GrepMatch {
  path: string
  line: number
  text: string
}

// Stream event types
export type StreamEventType =
  | { type: "message"; message: Message }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "tool_result"; toolResult: ToolResult }
  | { type: "interrupt"; request: HITLRequest }
  | { type: "token"; token: string }
  | { type: "todos"; todos: Todo[] }
  | { type: "workspace"; files: FileInfo[]; path: string }
  | { type: "subagents"; subagents: Subagent[] }
  | { type: "done"; result: unknown }
  | { type: "error"; error: string }

// IPC/API event types (for streaming)
export interface APIMessage {
  id: string
  type: "human" | "ai" | "tool" | "system"
  content: string
  tool_calls?: { id: string; name: string; args: Record<string, unknown> }[]
}

export interface APIValuesEvent {
  type: "values"
  data: {
    messages?: APIMessage[]
    todos?: { id?: string; content?: string; status?: string }[]
    files?: Record<string, unknown> | Array<{ path: string; is_dir?: boolean; size?: number }>
    workspacePath?: string
    subagents?: Array<{
      id?: string
      name?: string
      description?: string
      status?: string
      startedAt?: Date | string
      completedAt?: Date | string
    }>
    interrupt?: { id?: string; tool_call?: unknown }
  }
}

export interface APITokenEvent {
  type: "token"
  messageId: string
  token: string
}

export interface APIToolCallEvent {
  type: "tool_call"
  messageId: string | null
  tool_calls: Array<{ id?: string; name?: string; args?: string }>
}

export interface APIStreamEvent {
  type: "stream"
  mode: "messages" | "values"
  data: unknown
}

export interface APIDoneEvent {
  type: "done"
}

export interface APIErrorEvent {
  type: "error"
  error: string
}

export type APIEvent =
  | APIValuesEvent
  | APITokenEvent
  | APIToolCallEvent
  | APIStreamEvent
  | APIDoneEvent
  | APIErrorEvent

// Token usage tracking
export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

// Open file tab
export interface OpenFile {
  path: string
  name: string
  language?: string
}
