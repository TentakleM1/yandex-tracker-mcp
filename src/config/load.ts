import { existsSync, readFileSync } from "node:fs"
import { dirname, join, parse } from "node:path"
import { Config, configSchema } from "./schema.js"

const FILE = ".tracker-mcp.json"

export function loadConfig(startDir: string = process.cwd()): Config {
  let dir = startDir
  const rootPath = parse(dir).root
  while (true) {
    const candidate = join(dir, FILE)
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, "utf8"))
      return configSchema.parse(parsed)
    }
    if (dir === rootPath) return {}
    dir = dirname(dir)
  }
}
