import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  primaryKey,
  index
} from "drizzle-orm/pg-core"

// Threads table - stores conversation metadata
export const threads = pgTable(
  "threads",
  {
    threadId: text("thread_id").primaryKey(),
    title: text("title"),
    status: text("status").default("idle").notNull(),
    metadata: jsonb("metadata").$type<{
      model?: string
      daytonaSandboxId?: string
      e2bSandboxId?: string
    }>(),
    threadValues: jsonb("thread_values"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [index("threads_updated_at_idx").on(table.updatedAt)]
)

// Runs table - stores agent run history
export const runs = pgTable(
  "runs",
  {
    runId: text("run_id").primaryKey(),
    threadId: text("thread_id")
      .references(() => threads.threadId, { onDelete: "cascade" })
      .notNull(),
    assistantId: text("assistant_id"),
    status: text("status").default("pending").notNull(),
    metadata: jsonb("metadata"),
    kwargs: jsonb("kwargs"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [
    index("runs_thread_id_idx").on(table.threadId),
    index("runs_status_idx").on(table.status)
  ]
)

// LangGraph checkpoints table - stores agent state
export const checkpoints = pgTable(
  "checkpoints",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").default("").notNull(),
    checkpointId: text("checkpoint_id").notNull(),
    parentCheckpointId: text("parent_checkpoint_id"),
    type: text("type"),
    checkpoint: text("checkpoint").notNull(), // Serialized checkpoint data
    metadata: text("metadata")
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.checkpointNs, table.checkpointId] })
  ]
)

// LangGraph writes table - stores pending writes
export const writes = pgTable(
  "writes",
  {
    threadId: text("thread_id").notNull(),
    checkpointNs: text("checkpoint_ns").default("").notNull(),
    checkpointId: text("checkpoint_id").notNull(),
    taskId: text("task_id").notNull(),
    idx: integer("idx").notNull(),
    channel: text("channel").notNull(),
    type: text("type"),
    value: text("value")
  },
  (table) => [
    primaryKey({
      columns: [table.threadId, table.checkpointNs, table.checkpointId, table.taskId, table.idx]
    })
  ]
)

// Type exports for use throughout the app
export type Thread = typeof threads.$inferSelect
export type NewThread = typeof threads.$inferInsert
export type Checkpoint = typeof checkpoints.$inferSelect
export type Write = typeof writes.$inferSelect
