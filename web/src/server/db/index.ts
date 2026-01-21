import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required")
}

// For query purposes
const queryClient = postgres(connectionString)
export const db = drizzle(queryClient, { schema })
export const authDb = drizzle(queryClient)

// Export schema for use in API routes
export { schema }
