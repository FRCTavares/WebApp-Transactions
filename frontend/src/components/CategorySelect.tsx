import { useEffect, useState } from 'react'
import { CATEGORY_OPTIONS } from '../constants/categories'

const CUSTOM_CATEGORY_VALUE = '__custom_category__'

type CategorySelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function CategorySelect({ label, value, onChange }: CategorySelectProps) {
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false)
  const isKnownCategory = value === '' || CATEGORY_OPTIONS.includes(value)
  const selectedValue = isAddingCustomCategory || !isKnownCategory
    ? CUSTOM_CATEGORY_VALUE
    : value

  useEffect(() => {
    if (value !== '' && !CATEGORY_OPTIONS.includes(value)) {
      setIsAddingCustomCategory(true)
    }
  }, [value])

  return (
    <label>
      {label}
      <select
        value={selectedValue}
        onChange={(event) => {
          const nextValue = event.target.value

          if (nextValue === CUSTOM_CATEGORY_VALUE) {
            setIsAddingCustomCategory(true)
            onChange('')
            return
          }

          setIsAddingCustomCategory(false)
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

      {isAddingCustomCategory && (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="New category"
        />
      )}
    </label>
  )
}
