import { homedir } from "os"
import { join } from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import type { ProviderId } from "./types"

const PALMFRAME_DIR = join(homedir(), ".palmframe")
const LEGACY_DIR_NAME = ["o", "p", "e", "n", "w", "o", "r", "k"].join("")
const LEGACY_DIR = join(homedir(), `.${LEGACY_DIR_NAME}`)

function resolveAppDir(): string {
  if (existsSync(PALMFRAME_DIR)) return PALMFRAME_DIR
  if (existsSync(LEGACY_DIR)) return LEGACY_DIR
  mkdirSync(PALMFRAME_DIR, { recursive: true })
  return PALMFRAME_DIR
}

// Environment variable names for each provider
const ENV_VAR_NAMES: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
  ollama: "" // Ollama doesn't require an API key
}

export function getPalmframeDir(): string {
  return resolveAppDir()
}

export function getDbPath(): string {
  const dir = resolveAppDir()
  const legacyDbName = `${LEGACY_DIR_NAME}.sqlite`
  const dbName = dir === LEGACY_DIR ? legacyDbName : "palmframe.sqlite"
  return join(dir, dbName)
}

export function getCheckpointDbPath(): string {
  return join(resolveAppDir(), "langgraph.sqlite")
}

export function getThreadCheckpointDir(): string {
  const dir = join(resolveAppDir(), "threads")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getThreadCheckpointPath(threadId: string): string {
  return join(getThreadCheckpointDir(), `${threadId}.sqlite`)
}

export function deleteThreadCheckpoint(threadId: string): void {
  const path = getThreadCheckpointPath(threadId)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function getEnvFilePath(): string {
  return join(resolveAppDir(), ".env")
}

// Read .env file and parse into object
function parseEnvFile(): Record<string, string> {
  const envPath = getEnvFilePath()
  if (!existsSync(envPath)) return {}

  const content = readFileSync(envPath, "utf-8")
  const result: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      result[key] = value
    }
  }
  return result
}

// Write object back to .env file
function writeEnvFile(env: Record<string, string>): void {
  getPalmframeDir() // ensure dir exists
  const lines = Object.entries(env)
    .filter((entry) => entry[1])
    .map(([k, v]) => `${k}=${v}`)
  writeFileSync(getEnvFilePath(), lines.join("\n") + "\n")
}

// API key management
export function getApiKey(provider: string): string | undefined {
  const envVarName = ENV_VAR_NAMES[provider]
  if (!envVarName) return undefined

  // Check .env file first
  const env = parseEnvFile()
  if (env[envVarName]) return env[envVarName]

  // Fall back to process environment
  return process.env[envVarName]
}

export function setApiKey(provider: string, apiKey: string): void {
  const envVarName = ENV_VAR_NAMES[provider]
  if (!envVarName) return

  const env = parseEnvFile()
  env[envVarName] = apiKey
  writeEnvFile(env)

  // Also set in process.env for current session
  process.env[envVarName] = apiKey
}

export function deleteApiKey(provider: string): void {
  const envVarName = ENV_VAR_NAMES[provider]
  if (!envVarName) return

  const env = parseEnvFile()
  delete env[envVarName]
  writeEnvFile(env)

  // Also clear from process.env
  delete process.env[envVarName]
}

export function hasApiKey(provider: string): boolean {
  return !!getApiKey(provider)
}

// Bluesky credentials management (requires both identifier and app password)
const BLUESKY_IDENTIFIER_KEY = "BLUESKY_IDENTIFIER"
const BLUESKY_APP_PASSWORD_KEY = "BLUESKY_APP_PASSWORD"

export interface BlueskyCredentials {
  identifier: string
  appPassword: string
}

export function getBlueskyCredentials(): BlueskyCredentials | undefined {
  const env = parseEnvFile()
  const identifier = env[BLUESKY_IDENTIFIER_KEY] || process.env[BLUESKY_IDENTIFIER_KEY]
  const appPassword = env[BLUESKY_APP_PASSWORD_KEY] || process.env[BLUESKY_APP_PASSWORD_KEY]

  if (identifier && appPassword) {
    return { identifier, appPassword }
  }
  return undefined
}

export function setBlueskyCredentials(identifier: string, appPassword: string): void {
  const env = parseEnvFile()
  env[BLUESKY_IDENTIFIER_KEY] = identifier
  env[BLUESKY_APP_PASSWORD_KEY] = appPassword
  writeEnvFile(env)

  // Also set in process.env for current session
  process.env[BLUESKY_IDENTIFIER_KEY] = identifier
  process.env[BLUESKY_APP_PASSWORD_KEY] = appPassword
}

export function deleteBlueskyCredentials(): void {
  const env = parseEnvFile()
  delete env[BLUESKY_IDENTIFIER_KEY]
  delete env[BLUESKY_APP_PASSWORD_KEY]
  writeEnvFile(env)

  // Also clear from process.env
  delete process.env[BLUESKY_IDENTIFIER_KEY]
  delete process.env[BLUESKY_APP_PASSWORD_KEY]
}

export function hasBlueskyCredentials(): boolean {
  return !!getBlueskyCredentials()
}

// Daytona credentials management (API key and optional API URL)
const DAYTONA_API_KEY = "DAYTONA_API_KEY"
const DAYTONA_API_URL = "DAYTONA_API_URL"

export interface DaytonaCredentials {
  apiKey: string
  apiUrl: string
}

export function getDaytonaCredentials(): DaytonaCredentials | undefined {
  const env = parseEnvFile()
  const apiKey = env[DAYTONA_API_KEY] || process.env[DAYTONA_API_KEY]
  const apiUrl =
    env[DAYTONA_API_URL] || process.env[DAYTONA_API_URL] || "https://app.daytona.io/api"

  if (apiKey) {
    return { apiKey, apiUrl }
  }
  return undefined
}

export function setDaytonaCredentials(apiKey: string, apiUrl?: string): void {
  const env = parseEnvFile()
  env[DAYTONA_API_KEY] = apiKey
  if (apiUrl) {
    env[DAYTONA_API_URL] = apiUrl
  }
  writeEnvFile(env)

  // Also set in process.env for current session
  process.env[DAYTONA_API_KEY] = apiKey
  if (apiUrl) {
    process.env[DAYTONA_API_URL] = apiUrl
  }
}

export function deleteDaytonaCredentials(): void {
  const env = parseEnvFile()
  delete env[DAYTONA_API_KEY]
  delete env[DAYTONA_API_URL]
  writeEnvFile(env)

  // Also clear from process.env
  delete process.env[DAYTONA_API_KEY]
  delete process.env[DAYTONA_API_URL]
}

export function hasDaytonaCredentials(): boolean {
  return !!getDaytonaCredentials()
}

// E2B credentials management (API key only)
const E2B_API_KEY = "E2B_API_KEY"

export interface E2BCredentials {
  apiKey: string
}

export function getE2BCredentials(): E2BCredentials | undefined {
  const env = parseEnvFile()
  const apiKey = env[E2B_API_KEY] || process.env[E2B_API_KEY]

  if (apiKey) {
    return { apiKey }
  }
  return undefined
}

export function setE2BCredentials(apiKey: string): void {
  const env = parseEnvFile()
  env[E2B_API_KEY] = apiKey
  writeEnvFile(env)

  // Also set in process.env for current session
  process.env[E2B_API_KEY] = apiKey
}

export function deleteE2BCredentials(): void {
  const env = parseEnvFile()
  delete env[E2B_API_KEY]
  writeEnvFile(env)

  // Also clear from process.env
  delete process.env[E2B_API_KEY]
}

export function hasE2BCredentials(): boolean {
  return !!getE2BCredentials()
}
