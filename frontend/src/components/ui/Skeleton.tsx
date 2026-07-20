import './Skeleton.css'

export type SkeletonProps = {
  variant?: 'text' | 'block' | 'circle'
  width?: string
  height?: string
  /** Number of stacked lines. Only meaningful for variant="text". */
  lines?: number
}

/**
 * The app had no skeletons at all: one centred spinner for the whole
 * dashboard, and every other async surface popped in, shifting layout.
 *
 * Always give a skeleton the final height of the content it stands in for -
 * that is the entire point, and it is what stops the reflow.
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  if (variant === 'text' && lines > 1) {
    return (
      <span className="ui-skeleton-stack" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className="ui-skeleton ui-skeleton-text"
            /* Last line short, the way real wrapped text ends. */
            style={{ width: index === lines - 1 ? '60%' : width ?? '100%' }}
          />
        ))}
      </span>
    )
  }

  return (
    <span
      className={`ui-skeleton ui-skeleton-${variant}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
