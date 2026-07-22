import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'
export type CardElevation = 'flat' | 'raised' | 'floating'

export type CardProps = {
  padding?: CardPadding
  elevation?: CardElevation
  /** Adds hover/active affordance. Only use when the whole card is clickable. */
  interactive?: boolean
  /** Renders as <section> when a heading is present, else <div>. */
  as?: 'div' | 'section' | 'article'
  /**
   * Appended, not replaced. Reserved for layout concerns the card cannot know
   * about - grid placement, page-specific composition. Never for restyling the
   * card's surface, border or radius: that is what `padding` and `elevation`
   * are for, and a page reaching in to change them is how the app ended up
   * with six different card definitions.
   */
  className?: string
  children?: ReactNode
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>

/**
 * Replaces `.card`, `.panel-card`, `.content-card`, `.settings-card`,
 * `.summary-card`, `.dashboard-panel` and `.portfolio-snapshot`, which were
 * six-plus separate definitions of the same object with different borders,
 * radii and shadows.
 *
 * The Dashboard donut's `.expense-chart-card` was the last of them. Wrapping
 * it in a `Card` without stripping its own surface left a card inside a card,
 * visible in dark mode; it is now `.expense-chart-body` and owns no surface.
 */
export function Card({
  padding = 'md',
  elevation = 'flat',
  interactive = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    'ui-card',
    `ui-card-pad-${padding}`,
    `ui-card-${elevation}`,
    interactive ? 'ui-card-interactive' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag {...rest} className={classes}>
      {children}
    </Tag>
  )
}
