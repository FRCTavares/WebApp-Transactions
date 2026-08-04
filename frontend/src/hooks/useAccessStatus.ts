import { useEffect, useState } from 'react'
import { getAccessStatus } from '../api/accessRequests'
import type { AccessStatus } from '../types/api'

export function useAccessStatus(isActive: boolean) {
  const [status, setStatus] = useState<AccessStatus | null>(null)
  const [isLoading, setIsLoading] = useState(isActive)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) {
      return
    }

    let isCancelled = false

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true)

      getAccessStatus()
        .then((response) => {
          if (isCancelled) {
            return
          }
          setStatus(response.status)
          setError(null)
        })
        .catch((reason: unknown) => {
          if (isCancelled) {
            return
          }
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not check access status.',
          )
        })
        .finally(() => {
          if (isCancelled) {
            return
          }
          setIsLoading(false)
        })
    }, 0)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [isActive])

  return { error, isLoading, status }
}
