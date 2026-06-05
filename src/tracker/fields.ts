function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part]
    return undefined
  }, obj)
}

export function project<T extends object>(raw: T, fields: string[]): unknown {
  if (fields.includes("*")) return raw
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = pick(raw, f)
  return out
}

export function resolveFields(
  explicit: string[] | undefined,
  configDefault: string[] | undefined,
  builtIn: string[]
): string[] {
  return explicit ?? configDefault ?? builtIn
}
