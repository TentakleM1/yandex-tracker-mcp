export interface Guards {
  readOnly: boolean
  allowedQueues: string[] | null
}

export function parseGuards(env: Record<string, string | undefined>): Guards {
  const readOnly = env.TRACKER_READ_ONLY === "true"
  const raw = env.TRACKER_LIMIT_QUEUES?.trim()
  const allowedQueues = raw
    ? raw.split(",").map(q => q.trim()).filter(Boolean)
    : null
  return { readOnly, allowedQueues }
}

export function queueAllowed(guards: Guards, key: string): boolean {
  if (!guards.allowedQueues) return true
  const queue = key.split("-")[0]
  return guards.allowedQueues.includes(queue)
}
