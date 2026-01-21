/**
 * PostgreSQL checkpointer for LangGraph.
 *
 * Implements BaseCheckpointSaver to store LangGraph checkpoints in PostgreSQL
 * via Drizzle ORM, enabling thread history and HITL resume capabilities.
 */

import { db } from "@/server/db"
import { checkpoints, writes } from "@/server/db/schema"
import { eq, and, desc, lt } from "drizzle-orm"
import type { RunnableConfig } from "@langchain/core/runnables"
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointTuple,
  type SerializerProtocol,
  type PendingWrite,
  type CheckpointMetadata,
  copyCheckpoint
} from "@langchain/langgraph-checkpoint"

export class PostgresSaver extends BaseCheckpointSaver {
  constructor(serde?: SerializerProtocol) {
    super(serde)
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? ""
    const checkpointId = config.configurable?.checkpoint_id as string | undefined

    if (!threadId) {
      return undefined
    }

    let rows

    if (checkpointId) {
      rows = await db
        .select()
        .from(checkpoints)
        .where(
          and(
            eq(checkpoints.threadId, threadId),
            eq(checkpoints.checkpointNs, checkpointNs),
            eq(checkpoints.checkpointId, checkpointId)
          )
        )
    } else {
      rows = await db
        .select()
        .from(checkpoints)
        .where(and(eq(checkpoints.threadId, threadId), eq(checkpoints.checkpointNs, checkpointNs)))
        .orderBy(desc(checkpoints.checkpointId))
        .limit(1)
    }

    if (rows.length === 0) {
      return undefined
    }

    const row = rows[0]

    // Get pending writes
    const pendingWriteRows = await db
      .select()
      .from(writes)
      .where(
        and(
          eq(writes.threadId, row.threadId),
          eq(writes.checkpointNs, row.checkpointNs),
          eq(writes.checkpointId, row.checkpointId)
        )
      )

    const pendingWrites: [string, string, unknown][] = await Promise.all(
      pendingWriteRows.map(async (w) => {
        const value = await this.serde.loadsTyped(w.type ?? "json", w.value ?? "")
        return [w.taskId, w.channel, value] as [string, string, unknown]
      })
    )

    const checkpoint = (await this.serde.loadsTyped(
      row.type ?? "json",
      row.checkpoint
    )) as Checkpoint

    return {
      checkpoint,
      config: checkpointId
        ? config
        : {
            configurable: {
              thread_id: row.threadId,
              checkpoint_ns: row.checkpointNs,
              checkpoint_id: row.checkpointId
            }
          },
      metadata: (await this.serde.loadsTyped(
        row.type ?? "json",
        row.metadata ?? "{}"
      )) as CheckpointMetadata,
      parentConfig: row.parentCheckpointId
        ? {
            configurable: {
              thread_id: row.threadId,
              checkpoint_ns: row.checkpointNs,
              checkpoint_id: row.parentCheckpointId
            }
          }
        : undefined,
      pendingWrites
    }
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const { limit, before } = options ?? {}
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? ""

    if (!threadId) {
      return
    }

    const conditions = [eq(checkpoints.threadId, threadId), eq(checkpoints.checkpointNs, checkpointNs)]

    if (before?.configurable?.checkpoint_id) {
      conditions.push(lt(checkpoints.checkpointId, before.configurable.checkpoint_id as string))
    }

    let query = db
      .select()
      .from(checkpoints)
      .where(and(...conditions))
      .orderBy(desc(checkpoints.checkpointId))

    if (limit) {
      query = query.limit(limit) as typeof query
    }

    const rows = await query

    for (const row of rows) {
      const pendingWriteRows = await db
        .select()
        .from(writes)
        .where(
          and(
            eq(writes.threadId, row.threadId),
            eq(writes.checkpointNs, row.checkpointNs),
            eq(writes.checkpointId, row.checkpointId)
          )
        )

      const pendingWrites: [string, string, unknown][] = await Promise.all(
        pendingWriteRows.map(async (w) => {
          const value = await this.serde.loadsTyped(w.type ?? "json", w.value ?? "")
          return [w.taskId, w.channel, value] as [string, string, unknown]
        })
      )

      const checkpoint = (await this.serde.loadsTyped(
        row.type ?? "json",
        row.checkpoint
      )) as Checkpoint

      yield {
        config: {
          configurable: {
            thread_id: row.threadId,
            checkpoint_ns: row.checkpointNs,
            checkpoint_id: row.checkpointId
          }
        },
        checkpoint,
        metadata: (await this.serde.loadsTyped(
          row.type ?? "json",
          row.metadata ?? "{}"
        )) as CheckpointMetadata,
        parentConfig: row.parentCheckpointId
          ? {
              configurable: {
                thread_id: row.threadId,
                checkpoint_ns: row.checkpointNs,
                checkpoint_id: row.parentCheckpointId
              }
            }
          : undefined,
        pendingWrites
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? ""
    const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined

    const preparedCheckpoint = copyCheckpoint(checkpoint)

    const [[type1, serializedCheckpoint], [type2, serializedMetadata]] = await Promise.all([
      this.serde.dumpsTyped(preparedCheckpoint),
      this.serde.dumpsTyped(metadata)
    ])

    await db
      .insert(checkpoints)
      .values({
        threadId,
        checkpointNs,
        checkpointId: checkpoint.id,
        parentCheckpointId: parentCheckpointId ?? null,
        type: type1,
        checkpoint: serializedCheckpoint,
        metadata: serializedMetadata
      })
      .onConflictDoUpdate({
        target: [checkpoints.threadId, checkpoints.checkpointNs, checkpoints.checkpointId],
        set: {
          parentCheckpointId: parentCheckpointId ?? null,
          type: type1,
          checkpoint: serializedCheckpoint,
          metadata: serializedMetadata
        }
      })

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id
      }
    }
  }

  async putWrites(
    config: RunnableConfig,
    pendingWrites: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string
    const checkpointNs = (config.configurable?.checkpoint_ns as string) ?? ""
    const checkpointId = config.configurable?.checkpoint_id as string

    for (let idx = 0; idx < pendingWrites.length; idx++) {
      const write = pendingWrites[idx]
      const [type, serializedWrite] = await this.serde.dumpsTyped(write[1])

      await db
        .insert(writes)
        .values({
          threadId,
          checkpointNs,
          checkpointId,
          taskId,
          idx,
          channel: write[0],
          type,
          value: serializedWrite
        })
        .onConflictDoUpdate({
          target: [writes.threadId, writes.checkpointNs, writes.checkpointId, writes.taskId, writes.idx],
          set: {
            channel: write[0],
            type,
            value: serializedWrite
          }
        })
    }
  }
}
