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
  /**
   * Appended, not replaced. For layout concerns the badge cannot know about -
   * grid placement, responsive visibility. Never for changing its colours:
   * that is what `tone` is for.
   */
  className?: string
}

/**
 * Replaces `.badge` plus its ten modifier classes.
 *
 * Note there is no `text-transform: capitalize`. The old badge capitalised
 * everything, which mangled acronyms and multi-word source names
 * ("ActivoBank" -> "Activobank"). Callers pass the string they want shown.
 */
export function Badge({
  tone = 'neutral',
  size = 'md',
  children,
  title,
  className,
}: BadgeProps) {
  const classes = ['ui-badge', `ui-badge-${tone}`, `ui-badge-${size}`, className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} title={title}>
      {children}
    </span>
  )
}
