import { useId, useMemo, useState } from 'react'
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
  const [activeIndex, setActiveIndex] = useState(0)
  const listboxId = useId()

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
  const optionCount = filteredOptions.length + (shouldShowCreateOption ? 1 : 0)
  const selectedIndex = Math.min(activeIndex, Math.max(optionCount - 1, 0))

  function selectOption(index: number) {
    if (index < filteredOptions.length) {
      onChange(filteredOptions[index])
    } else if (shouldShowCreateOption) {
      onChange(value.trim())
    }

    setIsOpen(false)
  }

  const input = (
    <div className={`category-combobox ${className ?? ''}`}>
      <input
        className="table-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIsOpen(true)
            setActiveIndex((index) => Math.min(index + 1, optionCount - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setIsOpen(true)
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Home' && isOpen) {
            event.preventDefault()
            setActiveIndex(0)
          } else if (event.key === 'End' && isOpen) {
            event.preventDefault()
            setActiveIndex(Math.max(optionCount - 1, 0))
          } else if (event.key === 'Enter' && isOpen && optionCount > 0) {
            event.preventDefault()
            selectOption(selectedIndex)
          } else if (event.key === 'Escape' && isOpen) {
            event.preventDefault()
            setIsOpen(false)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120)
        }}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && optionCount > 0
            ? `${listboxId}-option-${selectedIndex}`
            : undefined
        }
      />

      {isOpen && (filteredOptions.length > 0 || shouldShowCreateOption) && (
        <div className="category-combobox-menu" id={listboxId} role="listbox">
          {filteredOptions.map((option, index) => (
            <button
              key={option}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selectedIndex === index}
              className={selectedIndex === index ? 'active' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => {
                selectOption(index)
              }}
            >
              {option}
            </button>
          ))}

          {shouldShowCreateOption && (
            <button
              id={`${listboxId}-option-${filteredOptions.length}`}
              type="button"
              role="option"
              aria-selected={selectedIndex === filteredOptions.length}
              className="category-combobox-create"
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActiveIndex(filteredOptions.length)}
              onClick={() => {
                selectOption(filteredOptions.length)
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
