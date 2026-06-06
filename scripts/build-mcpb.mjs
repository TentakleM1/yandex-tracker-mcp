#!/usr/bin/env node
// Builds the Claude Desktop Extension (.mcpb) bundle.
// Clean TypeScript build -> staging dir with prod-only node_modules -> mcpb validate -> mcpb pack.
// Output: releases/yandex-tracker.mcpb

import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const staging = join(root, "build", "mcpb")
const releases = join(root, "releases")
const out = join(releases, "yandex-tracker.mcpb")

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(" ")}`)
  execFileSync(cmd, args, { cwd, stdio: "inherit" })
}

// 1. Clean
rmSync(join(root, "dist"), { recursive: true, force: true })
rmSync(join(root, "build"), { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
mkdirSync(releases, { recursive: true })

// 2. Compile
run("npm", ["run", "build"])

// 3. Stage bundle contents
for (const f of ["dist", "manifest.json", "package.json", "package-lock.json", "README.md", "LICENSE"]) {
  cpSync(join(root, f), join(staging, f), { recursive: true })
}

// 4. Production dependencies only (no dev deps, no src, no tests)
run("npm", ["ci", "--omit=dev"], staging)

// 5. Validate + pack via the mcpb CLI (installed as a dev dependency)
const mcpb = process.platform === "win32" ? "mcpb.cmd" : "mcpb"
const mcpbBin = join(root, "node_modules", ".bin", mcpb)
run(mcpbBin, ["validate", join(staging, "manifest.json")])
run(mcpbBin, ["pack", staging, out])

console.log(`\nBundle ready: ${out}`)
