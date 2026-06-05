export interface TrackerError {
  statusCode: number
  errorMessages?: string[]
  errors?: Record<string, string>
}

export interface RawIssue {
  key: string
  summary: string
  [k: string]: unknown
}

export interface RawComment {
  id: number
  text: string
  createdBy?: { display?: string }
  createdAt?: string
}

export interface RawTransition {
  id: string
  display: string
  to?: { display?: string }
}
