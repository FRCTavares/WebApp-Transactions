import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconComponent, type IconSize } from './Icon'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders a spinner and blocks interaction without changing the button's width. */
  loading?: boolean
  iconLeft?: IconComponent
  iconRight?: IconComponent
  fullWidth?: boolean
  /**
   * Appended, not replaced. For concerns the button cannot know about -
   * responsive visibility, grid placement. Never for restyling it: that is
   * what `variant` and `size` are for.
   */
  className?: string
  children?: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>

const ICON_SIZE: Record<ButtonSize, IconSize> = { sm: 14, md: 16, lg: 20 }

/**
 * The single definition of what a button looks like.
 *
 * Replaces the eight de facto button sizes that were each defined
 * independently across the stylesheets (`.toolbar button`, `.page-header
 * button`, `td .action-group button`, `.transaction-mobile-actions button`,
 * `.mobile-more-actions button`, `.month-navigator button`, `.small-button`
 * and `.investment-trend-window-selector button`).
 *
 * `type` defaults to "button". The native default is "submit", which inside a
 * form makes every unmarked button submit it - a real bug source in this
 * codebase's inline table forms.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button-${variant}`,
    `ui-button-${size}`,
    fullWidth ? 'ui-button-full' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : null}
      {!loading && IconLeft ? (
        <Icon icon={IconLeft} size={ICON_SIZE[size]} aria-hidden="true" />
      ) : null}
      {children ? <span className="ui-button-label">{children}</span> : null}
      {!loading && IconRight ? (
        <Icon icon={IconRight} size={ICON_SIZE[size]} aria-hidden="true" />
      ) : null}
    </button>
  )
}
