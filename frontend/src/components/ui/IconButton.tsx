import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import './IconButton.css'
import type { ButtonSize, ButtonVariant } from './Button'

export type IconButtonProps = {
  icon: LucideIcon
  /**
   * Required, and becomes the button's accessible name.
   *
   * This is a prop rather than an option on purpose: the app previously had
   * icon-only and glyph-only controls with no accessible name at all, and
   * making the type system refuse to compile without one is the only reliable
   * way to stop that recurring.
   */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows the label as visible text next to the icon instead of hiding it. */
  showLabel?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'>

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 20 }

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  showLabel = false,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const classes = [
    'ui-icon-button',
    `ui-icon-button-${variant}`,
    `ui-icon-button-${size}`,
    showLabel ? 'ui-icon-button-with-label' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
    >
      <Icon size={ICON_SIZE[size]} aria-hidden="true" />
      {showLabel ? <span>{label}</span> : null}
    </button>
  )
}
