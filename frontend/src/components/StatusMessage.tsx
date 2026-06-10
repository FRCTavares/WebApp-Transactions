type StatusMessageProps = {
  error?: string | null
  message?: string | null
}

export function StatusMessage({ error, message }: StatusMessageProps) {
  if (!error && !message) {
    return null
  }

  return (
    <div className={error ? 'status status-error' : 'status status-ok'}>
      {error ?? message}
    </div>
  )
}
