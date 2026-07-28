import type { LucideIcon, LucideProps } from 'lucide-react'

export type IconComponent = LucideIcon
export type IconSize = 14 | 16 | 20 | 24

export type IconProps = {
  icon: IconComponent
  size?: IconSize
} & Omit<LucideProps, 'size'>

/**
 * The single app-level renderer for Lucide icons.
 *
 * Restricting sizes here prevents arbitrary call-site dimensions and keeps
 * icons aligned across buttons, navigation, tables, status feedback, and
 * empty states.
 */
export function Icon({
  icon: IconComponent,
  size = 16,
  ...rest
}: IconProps) {
  return <IconComponent {...rest} size={size} />
}
