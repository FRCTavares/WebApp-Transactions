import type { ReactNode } from 'react'
import './PageHeader.css'

export type PageHeaderProps = {
  /** Small label above the title, e.g. the active period. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/**
 * Resolves the two competing page scaffolds that coexisted in the codebase:
 * `.page-header` (base.css) and `.page-title-block` (index.css), the latter
 * described in its own comment as "Dashboard is the first page using this
 * visual baseline". Pages used one or the other, and `.page-header` carried a
 * `min-height: 3.5rem` that only made sense for the older one.
 *
 * `description` is rendered but hidden on narrow viewports, matching the
 * behaviour the page sheets were each implementing separately.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header-titles">
        {eyebrow ? <p className="ui-page-header-eyebrow">{eyebrow}</p> : null}
        <h1 className="ui-page-header-title">{title}</h1>
        {description ? (
          <p className="ui-page-header-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </header>
  )
}
