import { NextResponse } from "next/server"
import { PROVIDERS } from "@/lib/models"
import { hasProviderApiKey } from "@/server/config"
import type { ProviderId } from "@/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/models/providers - List providers with API key status
export async function GET() {
  try {
    const providers = PROVIDERS.map((provider) => ({
      ...provider,
      hasApiKey: hasProviderApiKey(provider.id as ProviderId)
    }))

    return NextResponse.json(providers)
  } catch (error) {
    console.error("[API] Failed to list providers:", error)
    return NextResponse.json({ error: "Failed to list providers" }, { status: 500 })
  }
}
