import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalPeriodSelector } from '../src/components/GlobalPeriodSelector'

const mocks = vi.hoisted(() => ({ usePeriod: vi.fn() }))
vi.mock('../src/hooks/usePeriod', () => ({ usePeriod: mocks.usePeriod }))

afterEach(cleanup)

function period(monthKey: string) {
  const value = { monthKey, setMonthKey: vi.fn(), shiftMonth: vi.fn(), resetToCurrentMonth: vi.fn() }
  mocks.usePeriod.mockReturnValue(value)
  return value
}

describe('GlobalPeriodSelector', () => {
  it('offers Today only once you have left the current month', async () => {
    const now = new Date()
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    period(current)
    const { unmount } = render(<GlobalPeriodSelector />)
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull()
    unmount()

    const away = period('2020-01')
    render(<GlobalPeriodSelector />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Today' }))
    expect(away.resetToCurrentMonth).toHaveBeenCalled()
  })

  it('steps a month at a time with labelled arrows', async () => {
    const value = period('2026-07')
    render(<GlobalPeriodSelector />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(value.shiftMonth).toHaveBeenNthCalledWith(1, -1)
    expect(value.shiftMonth).toHaveBeenNthCalledWith(2, 1)
  })
})
