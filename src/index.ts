#!/usr/bin/env node
import { TrackerClient } from "./tracker/client.js"
import { loadConfig } from "./config/load.js"
import { parseGuards } from "./guards.js"
import { buildServer } from "./server.js"
import { startStdio } from "./transport/stdio.js"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    process.stderr.write(`Missing ${name}. See README for setup.\n`)
    process.exit(1)
  }
  return v
}

async function main() {
  const token = requireEnv("TRACKER_TOKEN")
  const orgId = requireEnv("TRACKER_ORG_ID")
  const cloudOrg = process.env.TRACKER_CLOUD_ORG === "1"
  const client = new TrackerClient({ token, orgId, cloudOrg })
  const config = loadConfig()
  const guards = parseGuards(process.env)
  const webBase = cloudOrg ? "https://tracker.yandex.cloud" : "https://tracker.yandex.ru"
  const server = buildServer({ client, config, guards, webBase })
  await startStdio(server)
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${(e as Error).message}\n`)
  process.exit(1)
})
