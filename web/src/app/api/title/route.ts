import { NextRequest, NextResponse } from "next/server"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOpenAI } from "@langchain/openai"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatMistralAI } from "@langchain/mistralai"
import { getProviderApiKey } from "@/server/config"
import { DEFAULT_MODEL, getModelProvider } from "@/lib/models"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/title - Generate a thread title from the first message
 *
 * Request body:
 * - message: string - The first user message
 * - modelId?: string - Optional model ID to use
 *
 * Returns:
 * - title: string - Generated title
 */
export async function POST(request: NextRequest) {
  try {
    const { message, modelId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Use provided model or default
    const model = modelId || DEFAULT_MODEL
    const provider = getModelProvider(model)

    if (!provider) {
      return NextResponse.json({ error: "Invalid model ID" }, { status: 400 })
    }

    const apiKey = getProviderApiKey(provider)
    if (!apiKey) {
      // If no API key, generate a simple title from the message
      const simpleTitle = message.slice(0, 50).trim() + (message.length > 50 ? "..." : "")
      return NextResponse.json({ title: simpleTitle })
    }

    // Create appropriate model instance
    let llm: ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | ChatMistralAI

    switch (provider) {
      case "anthropic":
        llm = new ChatAnthropic({
          model: "claude-haiku-4-5-20251001", // Use fast model for title generation
          anthropicApiKey: apiKey
        })
        break
      case "openai":
        llm = new ChatOpenAI({
          model: "gpt-4o-mini",
          openAIApiKey: apiKey
        })
        break
      case "google":
        llm = new ChatGoogleGenerativeAI({
          model: "gemini-2.5-flash-lite",
          apiKey: apiKey
        })
        break
      case "mistral":
        llm = new ChatMistralAI({
          model: "mistral-small-latest",
          apiKey: apiKey
        })
        break
      default:
        // Fallback to simple title
        {
          const simpleTitle = message.slice(0, 50).trim() + (message.length > 50 ? "..." : "")
          return NextResponse.json({ title: simpleTitle })
        }
    }

    // Generate title
    const prompt = `Generate a very short (3-6 words) title for a conversation that starts with this message. Return ONLY the title, no quotes or explanation.

Message: ${message.slice(0, 500)}`

    const response = await llm.invoke(prompt)
    const title =
      typeof response.content === "string"
        ? response.content.trim().slice(0, 100)
        : message.slice(0, 50).trim() + (message.length > 50 ? "..." : "")

    return NextResponse.json({ title })
  } catch (error) {
    console.error("[API] Failed to generate title:", error)
    // Fallback to message-based title on error
    const { message } = await request.json().catch(() => ({ message: "New Thread" }))
    const simpleTitle = (message || "New Thread").slice(0, 50).trim()
    return NextResponse.json({ title: simpleTitle })
  }
}
