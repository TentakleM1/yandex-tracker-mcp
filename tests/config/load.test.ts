import { afterEach, beforeEach, expect, test } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../../src/config/load.js"

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "tmcfg-")) })
afterEach(() => rmSync(root, { recursive: true, force: true }))

test("returns empty config when no file found", () => {
  expect(loadConfig(root)).toEqual({})
})

test("loads config from cwd", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ defaultQueue: "PROJ" }))
  expect(loadConfig(root)).toEqual({ defaultQueue: "PROJ" })
})

test("finds config in a parent directory", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ defaultQueue: "UP" }))
  const child = join(root, "a", "b")
  mkdirSync(child, { recursive: true })
  expect(loadConfig(child)).toEqual({ defaultQueue: "UP" })
})

test("throws on unknown keys", () => {
  writeFileSync(join(root, ".tracker-mcp.json"), JSON.stringify({ bogus: 1 }))
  expect(() => loadConfig(root)).toThrow()
})
