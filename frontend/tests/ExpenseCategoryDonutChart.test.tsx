import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ExpenseCategoryDonutChart,
  type ExpenseCategoryChartItem,
} from '../src/components/dashboard/ExpenseCategoryDonutChart'

const items: ExpenseCategoryChartItem[] = [
  {
    category: 'Groceries',
    count: 3,
    personalTotal: 120,
  },
  {
    category: 'Transport',
    count: 2,
    personalTotal: 80,
  },
]

describe('ExpenseCategoryDonutChart', () => {
  it('keeps SVG slices presentational and exposes selection through legend buttons', () => {
    const { container } = render(
      <ExpenseCategoryDonutChart
        items={items}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
        onSelectCategory={vi.fn()}
      />,
    )

    const sliceGroup = container.querySelector('svg g[aria-hidden="true"]')
    const slices = container.querySelectorAll('.expense-chart-slice')

    expect(sliceGroup).toBeInTheDocument()
    expect(slices).toHaveLength(2)

    slices.forEach((slice) => {
      expect(slice).not.toHaveAttribute('tabindex')
      expect(slice).not.toHaveAttribute('role')
      expect(slice).not.toHaveAttribute('onclick')
    })

    expect(
      screen.getByRole('button', { name: /Groceries/i }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /Transport/i }),
    ).toBeEnabled()
  })

  it('selects a category from the legend with the keyboard', async () => {
    const onSelectCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <ExpenseCategoryDonutChart
        items={items}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
        onSelectCategory={onSelectCategory}
      />,
    )

    const groceriesButton = screen.getByRole('button', {
      name: /Groceries/i,
    })

    groceriesButton.focus()
    await user.keyboard('{Enter}')

    expect(onSelectCategory).toHaveBeenCalledTimes(1)
    expect(onSelectCategory).toHaveBeenCalledWith('Groceries')
  })

  it('reserves the chart surface while loading', () => {
    render(
      <ExpenseCategoryDonutChart
        items={[]}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
        isLoading
      />,
    )

    expect(
      screen.getByLabelText('Loading Spending by category'),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders an explicit empty state', () => {
    render(
      <ExpenseCategoryDonutChart
        items={[]}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
      />,
    )

    expect(screen.getByText('No spending')).toBeInTheDocument()
    expect(
      screen.getByText('Spending recorded for this month will appear here.'),
    ).toBeInTheDocument()
  })

  it('renders an explicit error state', () => {
    render(
      <ExpenseCategoryDonutChart
        items={[]}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
        error="Category summary unavailable"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Category summary unavailable',
    )
  })


  it('disables grouped Other because it cannot select one category', () => {
    const manyItems: ExpenseCategoryChartItem[] = [
      { category: 'One', count: 1, personalTotal: 60 },
      { category: 'Two', count: 1, personalTotal: 50 },
      { category: 'Three', count: 1, personalTotal: 40 },
      { category: 'Four', count: 1, personalTotal: 30 },
      { category: 'Five', count: 1, personalTotal: 20 },
      { category: 'Six', count: 1, personalTotal: 10 },
    ]

    render(
      <ExpenseCategoryDonutChart
        items={manyItems}
        title="Spending by category"
        description="Current month"
        emptyMessage="No spending"
        onSelectCategory={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /Other/i }),
    ).toBeDisabled()
  })
})
