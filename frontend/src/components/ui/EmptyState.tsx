import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import './EmptyState.css'

export type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Usually a <Button>. Give the user the action that fills the emptiness. */
  action?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * Empty states were previously a bare sentence, where they existed at all.
 * A good one explains why the space is empty and offers the action that
 * resolves it - which matters most on first run, when every surface is empty.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div className={`ui-empty-state ui-empty-state-${size}`}>
      {Icon ? (
        <span className="ui-empty-state-icon" aria-hidden="true">
          <Icon size={size === 'sm' ? 20 : 24} />
        </span>
      ) : null}
      <p className="ui-empty-state-title">{title}</p>
      {description ? (
        <p className="ui-empty-state-description">{description}</p>
      ) : null}
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  )
}
