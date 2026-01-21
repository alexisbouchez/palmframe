import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { authDb } from "@/server/db"

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required")
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL environment variable is required")
}

export const auth = betterAuth({
  database: drizzleAdapter(authDb, { provider: "pg" }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [nextCookies()]
})
