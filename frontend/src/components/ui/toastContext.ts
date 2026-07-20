import { createContext } from 'react'

export type ToastTone = 'positive' | 'negative' | 'warning' | 'info'

export type Toast = {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

export type ToastInput = Omit<Toast, 'id'> & { durationMs?: number }

export type ToastContextValue = {
  showToast: (toast: ToastInput) => void
  dismissToast: (id: string) => void
}

/* Split from ToastProvider.tsx so that file exports components only, which is
   what react-refresh/only-export-components requires. Same split the codebase
   already uses for themeContextValue.ts and authContext.ts. */
export const ToastContext = createContext<ToastContextValue | null>(null)
