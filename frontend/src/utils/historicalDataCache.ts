const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  expiresAt: number
  value: unknown
}

type LoadHistoricalDataOptions = {
  force?: boolean
  ttlMs?: number
}

const cachedValues = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<unknown>>()

let cacheGeneration = 0

export function buildHistoricalCacheKey(
  scope: string,
  userId: string,
  parameters = '',
) {
  return `${scope}:${userId}:${parameters}`
}

export function readHistoricalData<T>(key: string): T | undefined {
  const entry = cachedValues.get(key)

  if (!entry) {
    return undefined
  }

  if (entry.expiresAt <= Date.now()) {
    cachedValues.delete(key)
    return undefined
  }

  return entry.value as T
}

export function loadHistoricalData<T>(
  key: string,
  loader: () => Promise<T>,
  options: LoadHistoricalDataOptions = {},
): Promise<T> {
  const force = options.force ?? false
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS

  if (!force) {
    const cachedValue = readHistoricalData<T>(key)

    if (cachedValue !== undefined) {
      return Promise.resolve(cachedValue)
    }

    const existingRequest = inFlightRequests.get(key)

    if (existingRequest) {
      return existingRequest as Promise<T>
    }
  }

  const requestGeneration = cacheGeneration

  const request = loader()
    .then((value) => {
      if (requestGeneration === cacheGeneration) {
        cachedValues.set(key, {
          expiresAt: Date.now() + ttlMs,
          value,
        })
      }

      return value
    })
    .finally(() => {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key)
      }
    })

  inFlightRequests.set(key, request)

  return request
}

export function invalidateHistoricalData(): void {
  cacheGeneration += 1
  cachedValues.clear()
  inFlightRequests.clear()
}
