import { CATEGORY_OPTIONS } from '../constants/categories'

const CUSTOM_CATEGORY_VALUE = '__custom_category__'

type CategorySelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function CategorySelect({ label, value, onChange }: CategorySelectProps) {
  const isCustomCategory = value !== '' && !CATEGORY_OPTIONS.includes(value)
  const selectedValue = isCustomCategory ? CUSTOM_CATEGORY_VALUE : value

  return (
    <label>
      {label}
      <select
        value={selectedValue}
        onChange={(event) => {
          const nextValue = event.target.value

          if (nextValue === CUSTOM_CATEGORY_VALUE) {
            onChange('')
            return
          }

          onChange(nextValue)
        }}
      >
        <option value="">Uncategorised</option>
        {CATEGORY_OPTIONS.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value={CUSTOM_CATEGORY_VALUE}>+ Add new category</option>
      </select>

      {selectedValue === CUSTOM_CATEGORY_VALUE || isCustomCategory ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="New category"
        />
      ) : null}
    </label>
  )
}
