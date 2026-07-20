import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ToastContext, type Toast, type ToastInput, type ToastTone } from './toastContext'
import { IconButton } from './IconButton'
import './Toast.css'

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  positive: CheckCircle2,
  negative: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const DEFAULT_DURATION_MS = 5000

/**
 * Transient feedback did not exist in this app. The only channel was
 * `StatusMessage`, a full-width banner that pushes layout down and stays until
 * something else replaces it - unusable for "Saved" or "Copied".
 *
 * Errors are deliberately not auto-dismissed: a user who looked away must not
 * lose the only notice that their edit failed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    ({ durationMs, ...toast }: ToastInput) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current, { ...toast, id }])

      const timeout = durationMs ?? (toast.tone === 'negative' ? 0 : DEFAULT_DURATION_MS)
      if (timeout > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissToast(id), timeout),
        )
      }
    },
    [dismissToast],
  )

  // Clear pending timers on unmount so a fired timeout cannot setState on an
  // unmounted provider. The codebase hit exactly this before, in
  // usePresentationPreferences, as a CI-only unhandled rejection.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer)
      }
      pending.clear()
    }
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone]
          return (
            <div
              key={toast.id}
              className={`ui-toast ui-toast-${toast.tone}`}
              role={toast.tone === 'negative' ? 'alert' : 'status'}
              aria-live={toast.tone === 'negative' ? 'assertive' : 'polite'}
            >
              <Icon className="ui-toast-icon" size={16} aria-hidden="true" />
              <div className="ui-toast-copy">
                <p className="ui-toast-title">{toast.title}</p>
                {toast.description ? (
                  <p className="ui-toast-description">{toast.description}</p>
                ) : null}
              </div>
              <IconButton
                icon={X}
                label={`Dismiss: ${toast.title}`}
                size="sm"
                onClick={() => dismissToast(toast.id)}
              />
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
