import { useMemo, useState } from 'react'
import { CATEGORY_OPTIONS } from '../constants/categories'

type CategorySelectProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  options?: string[]
  placeholder?: string
  className?: string
  allowCreate?: boolean
}

function normaliseOption(value: string) {
  return value.trim().toLowerCase()
}

function getUniqueOptions(options: string[]) {
  const seen = new Set<string>()
  const uniqueOptions: string[] = []

  for (const option of options) {
    const trimmedOption = option.trim()

    if (!trimmedOption) {
      continue
    }

    const key = normaliseOption(trimmedOption)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueOptions.push(trimmedOption)
  }

  return uniqueOptions
}

export function CategorySelect({
  label,
  value,
  onChange,
  options = CATEGORY_OPTIONS,
  placeholder = 'Type to search or create',
  className,
  allowCreate = true,
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options])
  const searchValue = normaliseOption(value)

  const filteredOptions = uniqueOptions.filter((option) =>
    normaliseOption(option).includes(searchValue),
  )

  const hasExactMatch = uniqueOptions.some(
    (option) => normaliseOption(option) === searchValue,
  )

  const shouldShowCreateOption =
    allowCreate && value.trim() !== '' && !hasExactMatch

  const input = (
    <div className={`category-combobox ${className ?? ''}`}>
      <input
        className="table-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120)
        }}
        placeholder={placeholder}
      />

      {isOpen && (filteredOptions.length > 0 || shouldShowCreateOption) && (
        <div className="category-combobox-menu">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option)
                setIsOpen(false)
              }}
            >
              {option}
            </button>
          ))}

          {shouldShowCreateOption && (
            <button
              type="button"
              className="category-combobox-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(value.trim())
                setIsOpen(false)
              }}
            >
              Create “{value.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (!label) {
    return input
  }

  return (
    <label>
      {label}
      {input}
    </label>
  )
}
