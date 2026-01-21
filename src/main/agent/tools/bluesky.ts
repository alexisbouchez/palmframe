import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { AtpAgent } from "@atproto/api"

// Create a shared agent instance for the public Bluesky API
const blueskyAgent = new AtpAgent({ service: "https://public.api.bsky.app" })

/**
 * Search for posts on Bluesky social network.
 * Uses the public Bluesky API - no authentication required.
 */
export const searchBlueskyPosts = tool(
  async ({
    query,
    limit = 10,
    sort = "latest"
  }: {
    query: string
    limit?: number
    sort?: "top" | "latest"
  }) => {
    try {
      console.log(`[Bluesky] Searching posts for: "${query}" (limit: ${limit}, sort: ${sort})`)

      const response = await blueskyAgent.app.bsky.feed.searchPosts({
        q: query,
        limit: Math.min(limit, 25), // API max is typically 25
        sort
      })

      if (!response.success) {
        return JSON.stringify({ error: "Search request failed", posts: [] })
      }

      const posts = response.data.posts.map((post) => {
        const record = post.record as {
          text?: string
          createdAt?: string
        }

        return {
          uri: post.uri,
          cid: post.cid,
          author: {
            handle: post.author.handle,
            displayName: post.author.displayName || post.author.handle,
            avatar: post.author.avatar
          },
          text: record.text || "",
          createdAt: record.createdAt,
          likeCount: post.likeCount || 0,
          repostCount: post.repostCount || 0,
          replyCount: post.replyCount || 0,
          url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`
        }
      })

      console.log(`[Bluesky] Found ${posts.length} posts`)

      return JSON.stringify({
        query,
        count: posts.length,
        posts
      })
    } catch (error) {
      console.error("[Bluesky] Search error:", error)
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        posts: []
      })
    }
  },
  {
    name: "search_bluesky",
    description:
      "Search for posts on Bluesky social network. Use this to find recent discussions, opinions, news, or any public content shared on Bluesky. Returns post text, author info, and engagement metrics.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "The search query. Can include keywords, hashtags, or phrases. Use quotes for exact phrases."
        ),
      limit: z
        .number()
        .min(1)
        .max(25)
        .optional()
        .default(10)
        .describe("Maximum number of posts to return (1-25, default: 10)"),
      sort: z
        .enum(["top", "latest"])
        .optional()
        .default("latest")
        .describe("Sort order: 'top' for most engaged posts, 'latest' for most recent")
    })
  }
)

/**
 * Get a user's profile and recent posts on Bluesky.
 */
export const getBlueskyProfile = tool(
  async ({ handle, postsLimit = 5 }: { handle: string; postsLimit?: number }) => {
    try {
      // Normalize handle - remove @ prefix if present
      const normalizedHandle = handle.startsWith("@") ? handle.slice(1) : handle

      console.log(`[Bluesky] Getting profile for: ${normalizedHandle}`)

      // Get profile
      const profileResponse = await blueskyAgent.app.bsky.actor.getProfile({
        actor: normalizedHandle
      })

      if (!profileResponse.success) {
        return JSON.stringify({ error: "Failed to fetch profile" })
      }

      const profile = profileResponse.data

      // Get recent posts
      const feedResponse = await blueskyAgent.app.bsky.feed.getAuthorFeed({
        actor: normalizedHandle,
        limit: Math.min(postsLimit, 25)
      })

      const recentPosts = feedResponse.success
        ? feedResponse.data.feed.map((item) => {
            const record = item.post.record as {
              text?: string
              createdAt?: string
            }
            return {
              text: record.text || "",
              createdAt: record.createdAt,
              likeCount: item.post.likeCount || 0,
              repostCount: item.post.repostCount || 0,
              url: `https://bsky.app/profile/${profile.handle}/post/${item.post.uri.split("/").pop()}`
            }
          })
        : []

      return JSON.stringify({
        handle: profile.handle,
        displayName: profile.displayName || profile.handle,
        description: profile.description || "",
        avatar: profile.avatar,
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 0,
        postsCount: profile.postsCount || 0,
        url: `https://bsky.app/profile/${profile.handle}`,
        recentPosts
      })
    } catch (error) {
      console.error("[Bluesky] Profile error:", error)
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  },
  {
    name: "get_bluesky_profile",
    description:
      "Get a Bluesky user's profile information and their recent posts. Use this to learn about a specific user, their bio, follower count, and what they've been posting.",
    schema: z.object({
      handle: z
        .string()
        .describe(
          "The Bluesky handle (username) to look up, e.g. 'alice.bsky.social' or '@alice.bsky.social'"
        ),
      postsLimit: z
        .number()
        .min(0)
        .max(25)
        .optional()
        .default(5)
        .describe("Number of recent posts to include (0-25, default: 5)")
    })
  }
)

// Export all Bluesky tools as an array for easy integration
export const blueskyTools = [searchBlueskyPosts, getBlueskyProfile]
