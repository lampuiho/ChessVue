export function parseUtc(utc: string): number {
  const parsed = Date.parse(utc)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid UTC timestamp: ${utc}`)
  }

  return parsed
}

export function getElapsedMs(startUtc: string, endUtc: string): number {
  return Math.max(0, parseUtc(endUtc) - parseUtc(startUtc))
}
