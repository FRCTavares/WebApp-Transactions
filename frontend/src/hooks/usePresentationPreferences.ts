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
    apiGet<PresentationPreferences>('/api/preferences')
      .then((loaded) => {
        configureFormatters(loaded)
        setPreferences(loaded)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load preferences.')
      })
      .finally(() => setIsLoading(false))
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
