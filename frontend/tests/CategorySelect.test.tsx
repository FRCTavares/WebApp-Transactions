import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CategorySelect } from '../src/components/CategorySelect'

function ControlledCategorySelect({
  options,
  onChange,
}: {
  options: string[]
  onChange: (value: string) => void
}) {
  const [value, setValue] = useState('')

  return (
    <CategorySelect
      label="Category"
      value={value}
      options={options}
      onChange={(nextValue) => {
        setValue(nextValue)
        onChange(nextValue)
      }}
    />
  )
}

describe('CategorySelect keyboard combobox behavior', () => {
  it('filters options as the user types', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ControlledCategorySelect
        options={['Groceries', 'Gifts', 'Rent']}
        onChange={onChange}
      />,
    )

    await user.type(screen.getByRole('combobox'), 'Gr')

    expect(await screen.findByRole('option', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Rent' })).not.toBeInTheDocument()
  })

  it('navigates with ArrowDown and selects with Enter', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ControlledCategorySelect
        options={['Groceries', 'Gifts', 'Rent']}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenLastCalledWith('Gifts')
  })

  it('closes the menu on Escape without selecting', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ControlledCategorySelect
        options={['Groceries', 'Gifts', 'Rent']}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers to create a new category when there is no exact match', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ControlledCategorySelect options={['Groceries']} onChange={onChange} />,
    )

    await user.type(screen.getByRole('combobox'), 'Streaming')

    const createOption = await screen.findByRole('option', {
      name: 'Create “Streaming”',
    })
    await user.click(createOption)

    expect(onChange).toHaveBeenLastCalledWith('Streaming')
  })
})
