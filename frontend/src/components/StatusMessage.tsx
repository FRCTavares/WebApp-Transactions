import { CheckCircle2, XCircle } from 'lucide-react'
import { Icon } from './ui'

type StatusMessageProps = {
  error?: string | null
  message?: string | null
}

export function StatusMessage({ error, message }: StatusMessageProps) {
  if (!error && !message) {
    return null
  }

  const StatusIcon = error ? XCircle : CheckCircle2

  return (
    <div
      className={error ? 'status status-error' : 'status status-ok'}
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
    >
      <Icon icon={StatusIcon} size={16} aria-hidden="true" />
      <span>{error ?? message}</span>
    </div>
  )
}
