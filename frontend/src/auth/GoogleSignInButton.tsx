import { useEffect, useRef } from 'react'
import { renderGoogleButton } from './googleIdentity'

type GoogleSignInButtonProps = {
  onError: (message: string) => void
}

export function GoogleSignInButton({ onError }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = container.current
    if (!parent) return
    renderGoogleButton(parent, onError).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Google sign-in is unavailable.')
    })
  }, [onError])

  return <div ref={container} className="google-sign-in" />
}
