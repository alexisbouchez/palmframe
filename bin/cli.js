#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Palmframe CLI - Launches the Electron app
 */

const { spawn } = require("child_process")
const path = require("path")

// Set process title for Activity Monitor
process.title = "palmframe"

const args = process.argv.slice(2)
const cliName = path.basename(process.argv[1] || "palmframe")

// Handle --version flag
if (args.includes("--version") || args.includes("-v")) {
  const { version } = require("../package.json")
  console.log(`${cliName} v${version}`)
  process.exit(0)
}

// Handle --help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Palmframe - A tactical agent interface for deepagentsjs

Usage:
  ${cliName}              Launch the application
  ${cliName} --version    Show version
  ${cliName} --help       Show this help
`)
  process.exit(0)
}

// Get the path to electron
const electron = require("electron")

// Launch electron with our main process
const mainPath = path.join(__dirname, "..", "out", "main", "index.js")

const child = spawn(electron, [mainPath, ...args], {
  stdio: "inherit"
})

// Forward signals to child process
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function forwardSignal(signal) {
  if (child.pid) {
    process.kill(child.pid, signal)
  }
}

process.on("SIGINT", () => forwardSignal("SIGINT"))
process.on("SIGTERM", () => forwardSignal("SIGTERM"))

// Exit with the same code as the child
child.on("close", (code) => {
  process.exit(code ?? 0)
})

child.on("error", (err) => {
  console.error(`Failed to start ${cliName}:`, err.message)
  process.exit(1)
})
