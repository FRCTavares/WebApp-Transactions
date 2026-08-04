import { useCallback, useEffect, useState } from 'react'
import {
  approvePendingSignup,
  denyPendingSignup,
  listPendingSignups,
} from '../api/accessRequests'
import { ApiError } from '../api/client'
import type { PendingSignup } from '../types/api'
import { Button } from './ui'

export function AccessRequestsPanel() {
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPendingSignups = useCallback(() => {
    setIsLoading(true)

    listPendingSignups()
      .then((signups) => {
        setPendingSignups(signups)
        setIsVisible(true)
        setError(null)
      })
      .catch((reason: unknown) => {
        // Only an admin account can see this endpoint. Anyone else gets a
        // 403, which just means: don't show this panel at all.
        if (reason instanceof ApiError && reason.status === 403) {
          setIsVisible(false)
          return
        }

        setIsVisible(true)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not load pending sign-in requests.',
        )
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPendingSignups()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadPendingSignups])

  async function handleDecision(id: number, decide: (id: number) => Promise<PendingSignup>) {
    setBusyId(id)
    setError(null)

    try {
      await decide(id)
      setPendingSignups((current) => current.filter((signup) => signup.id !== id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That action failed.')
    } finally {
      setBusyId(null)
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <section className="settings-group settings-group-access-requests">
      <header className="settings-group-header">
        <h2>Access requests</h2>
      </header>

      {error && <p className="status status-error" role="alert">{error}</p>}

      {!isLoading && pendingSignups.length === 0 && !error && (
        <p className="muted">No one is waiting for approval right now.</p>
      )}

      {pendingSignups.map((signup) => (
        <div className="settings-list-row" key={signup.id}>
          <span>
            <strong>{signup.email}</strong>
            <small>Signed in and waiting for approval.</small>
          </span>
          <span className="settings-access-request-actions">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busyId === signup.id}
              disabled={busyId !== null}
              onClick={() => void handleDecision(signup.id, denyPendingSignup)}
            >
              Deny
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={busyId === signup.id}
              disabled={busyId !== null}
              onClick={() => void handleDecision(signup.id, approvePendingSignup)}
            >
              Approve
            </Button>
          </span>
        </div>
      ))}
    </section>
  )
}
