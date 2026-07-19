import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPutJson } from '../api/client'
import {
  configureFormatters,
  DEFAULT_PRESENTATION_PREFERENCES,
  type PresentationPreferences,
} from '../utils/format'

export function usePresentationPreferences(isActive: boolean) {
  const [preferences, setPreferences] = useState(DEFAULT_PRESENTATION_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive) {
      return
    }

    let isCancelled = false

    apiGet<PresentationPreferences>('/api/preferences')
      .then((loaded) => {
        if (isCancelled) {
          return
        }
        configureFormatters(loaded)
        setPreferences(loaded)
      })
      .catch((reason: unknown) => {
        if (isCancelled) {
          return
        }
        setError(reason instanceof Error ? reason.message : 'Could not load preferences.')
      })
      .finally(() => {
        if (isCancelled) {
          return
        }
        setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [isActive])

  const save = useCallback(async (next: PresentationPreferences) => {
    const saved = await apiPutJson<PresentationPreferences>('/api/preferences', next)
    configureFormatters(saved)
    setPreferences(saved)
    setError(null)
    return saved
  }, [])

  return { error, isLoading, preferences, save }
}
