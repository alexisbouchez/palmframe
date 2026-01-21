/**
 * Server-side configuration - validated at runtime
 */

export const config = {
  database: {
    url: process.env.DATABASE_URL!
  },
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY
    },
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY
    }
  },
  sandboxes: {
    daytona: {
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api"
    },
    e2b: {
      apiKey: process.env.E2B_API_KEY
    }
  },
  bluesky: {
    identifier: process.env.BLUESKY_IDENTIFIER,
    appPassword: process.env.BLUESKY_APP_PASSWORD
  }
} as const

export type ProviderId = "anthropic" | "openai" | "google" | "mistral"

export function getProviderApiKey(provider: ProviderId): string | undefined {
  switch (provider) {
    case "anthropic":
      return config.providers.anthropic.apiKey
    case "openai":
      return config.providers.openai.apiKey
    case "google":
      return config.providers.google.apiKey
    case "mistral":
      return config.providers.mistral.apiKey
    default:
      return undefined
  }
}

export function hasProviderApiKey(provider: ProviderId): boolean {
  return !!getProviderApiKey(provider)
}

export function hasDaytonaCredentials(): boolean {
  return !!config.sandboxes.daytona.apiKey
}

export function hasE2BCredentials(): boolean {
  return !!config.sandboxes.e2b.apiKey
}
