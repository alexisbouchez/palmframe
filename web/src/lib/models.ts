import type { ModelConfig, Provider, ProviderId } from "@/types"

// Provider configurations
export const PROVIDERS: Omit<Provider, "hasApiKey">[] = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
  { id: "mistral", name: "Mistral" }
]

// Available models configuration (updated Jan 2026)
export const AVAILABLE_MODELS: Omit<ModelConfig, "available">[] = [
  // Anthropic Claude 4.5 series (latest as of Jan 2026)
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    model: "claude-opus-4-5-20251101",
    description: "Premium model with maximum intelligence"
  },
  {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    description: "Best balance of intelligence, speed, and cost for agents"
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    description: "Fastest model with near-frontier intelligence"
  },
  // Anthropic Claude legacy models
  {
    id: "claude-opus-4-1-20250805",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    model: "claude-opus-4-1-20250805",
    description: "Previous generation premium model with extended thinking"
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    description: "Fast and capable previous generation model"
  },
  // OpenAI GPT-5 series (latest as of Jan 2026)
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    model: "gpt-5.2",
    description: "Latest flagship with enhanced coding and agentic capabilities"
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    model: "gpt-5.1",
    description: "Advanced reasoning and robust performance"
  },
  // OpenAI o-series reasoning models
  {
    id: "o3",
    name: "o3",
    provider: "openai",
    model: "o3",
    description: "Advanced reasoning for complex problem-solving"
  },
  {
    id: "o3-mini",
    name: "o3 Mini",
    provider: "openai",
    model: "o3-mini",
    description: "Cost-effective reasoning with faster response times"
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    provider: "openai",
    model: "o4-mini",
    description: "Fast, efficient reasoning model succeeding o3"
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    model: "o1",
    description: "Premium reasoning for research, coding, math and science"
  },
  // OpenAI GPT-4 series
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
    description: "Strong instruction-following with 1M context window"
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    model: "gpt-4.1-mini",
    description: "Faster, smaller version balancing performance and efficiency"
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    model: "gpt-4.1-nano",
    description: "Most cost-efficient for lighter tasks"
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    description: "Versatile model for text generation and comprehension"
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    description: "Cost-efficient variant with faster response times"
  },
  // Google Gemini models
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    model: "gemini-3-pro-preview",
    description: "State-of-the-art reasoning and multimodal understanding"
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    model: "gemini-3-flash-preview",
    description: "Fast frontier-class model with low latency and cost"
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    model: "gemini-2.5-pro",
    description: "High-capability model for complex reasoning and coding"
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    model: "gemini-2.5-flash",
    description: "Lightning-fast with balance of intelligence and latency"
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    description: "Fast, low-cost, high-performance model"
  },
  // Mistral AI models
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    model: "mistral-large-latest",
    description: "Flagship model with top-tier reasoning and multilingual capabilities"
  },
  {
    id: "mistral-medium-latest",
    name: "Mistral Medium",
    provider: "mistral",
    model: "mistral-medium-latest",
    description: "Balanced model for complex tasks with good cost efficiency"
  },
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    provider: "mistral",
    model: "mistral-small-latest",
    description: "Fast and cost-effective for simpler tasks"
  },
  {
    id: "codestral-latest",
    name: "Codestral",
    provider: "mistral",
    model: "codestral-latest",
    description: "Specialized model for code generation and understanding"
  },
  {
    id: "pixtral-large-latest",
    name: "Pixtral Large",
    provider: "mistral",
    model: "pixtral-large-latest",
    description: "Multimodal model with advanced vision capabilities"
  },
  {
    id: "ministral-8b-latest",
    name: "Ministral 8B",
    provider: "mistral",
    model: "ministral-8b-latest",
    description: "Compact model optimized for edge deployment and low latency"
  }
]

export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

export function getModelById(modelId: string): (typeof AVAILABLE_MODELS)[number] | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)
}

export function getModelProvider(modelId: string): ProviderId | undefined {
  return getModelById(modelId)?.provider
}
