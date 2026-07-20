import './SegmentedControl.css'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Chart range". */
  label: string
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

/**
 * Replaces `.mobile-segmented-control`, `.investment-trend-window-selector`,
 * `.transaction-direction-switch`, `.dashboard-chart-toggle` and
 * `.owed-page-polished .segmented-control` - five separate implementations of
 * one control, none of which exposed the group relationship to assistive tech.
 *
 * Uses radio semantics so the selected option is announced as "1 of 3"
 * rather than as three unrelated buttons.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={[
        'ui-segmented',
        `ui-segmented-${size}`,
        fullWidth ? 'ui-segmented-full' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`ui-segmented-option${isSelected ? ' is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
