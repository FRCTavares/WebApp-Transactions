import type { ReactNode } from 'react'
import './Badge.css'

export type BadgeTone =
  | 'neutral'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'expense'
  | 'investment'
  | 'accent'

export type BadgeProps = {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  children: ReactNode
  title?: string
}

/**
 * Replaces `.badge` plus its ten modifier classes.
 *
 * Note there is no `text-transform: capitalize`. The old badge capitalised
 * everything, which mangled acronyms and multi-word source names
 * ("ActivoBank" -> "Activobank"). Callers pass the string they want shown.
 */
export function Badge({ tone = 'neutral', size = 'md', children, title }: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge-${tone} ui-badge-${size}`} title={title}>
      {children}
    </span>
  )
}
