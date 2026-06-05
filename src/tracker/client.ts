export interface TrackerClientOptions {
  token: string
  orgId: string
  cloudOrg: boolean
  baseUrl?: string
}

export class TrackerClient {
  private base: string
  private headers: Record<string, string>

  constructor(opts: TrackerClientOptions) {
    this.base = (opts.baseUrl ?? "https://api.tracker.yandex.net") + "/v2"
    const orgHeader = opts.cloudOrg ? "X-Cloud-Org-ID" : "X-Org-ID"
    this.headers = {
      Authorization: `OAuth ${opts.token}`,
      [orgHeader]: opts.orgId,
      "Content-Type": "application/json"
    }
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) {
      const msg = data?.errorMessages?.join("; ") ?? data?.message ?? res.statusText
      throw new Error(`Tracker API ${res.status}: ${msg}`)
    }
    return data as T
  }
}
