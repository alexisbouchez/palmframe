import { NextResponse } from "next/server"
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/models"
import { hasProviderApiKey } from "@/server/config"
import type { ProviderId } from "@/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/models - List available models
export async function GET() {
  try {
    const models = AVAILABLE_MODELS.map((model) => ({
      ...model,
      available: hasProviderApiKey(model.provider as ProviderId)
    }))

    return NextResponse.json({
      models,
      defaultModel: DEFAULT_MODEL
    })
  } catch (error) {
    console.error("[API] Failed to list models:", error)
    return NextResponse.json({ error: "Failed to list models" }, { status: 500 })
  }
}
