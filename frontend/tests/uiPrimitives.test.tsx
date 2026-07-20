import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SegmentedControl,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../src/components/ui'

describe('Button', () => {
  it('defaults to type="button" so it does not submit an enclosing form', () => {
    const onSubmit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Button>Save</Button>
      </form>,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('is disabled and marked busy while loading, and does not fire onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    await userEvent.click(button, { pointerEventsCheck: 0 })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('keeps its accessible name when an icon is added', () => {
    render(<Button iconLeft={Plus}>Add transaction</Button>)
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument()
  })

  it('applies variant and size classes', () => {
    render(
      <Button variant="danger" size="lg">
        Delete
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button.className).toContain('ui-button-danger')
    expect(button.className).toContain('ui-button-lg')
  })
})

describe('IconButton', () => {
  it('exposes its required label as the accessible name', () => {
    render(<IconButton icon={Trash2} label="Delete Rent" />)
    expect(screen.getByRole('button', { name: 'Delete Rent' })).toBeInTheDocument()
  })

  it('uses visible text instead of aria-label when showLabel is set', () => {
    render(<IconButton icon={Trash2} label="Delete" showLabel />)
    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).not.toHaveAttribute('aria-label')
    expect(within(button).getByText('Delete')).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('links label and control, and exposes the hint via aria-describedby', () => {
    render(
      <Field label="Amount" hint="Use a positive number">
        {(props) => <input {...props} />}
      </Field>,
    )
    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAccessibleDescription('Use a positive number')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('marks the control invalid and announces the error instead of the hint', () => {
    render(
      <Field label="Amount" hint="Use a positive number" error="Amount is required">
        {(props) => <input {...props} />}
      </Field>,
    )
    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Amount is required')
    expect(screen.getByRole('alert')).toHaveTextContent('Amount is required')
    expect(screen.queryByText('Use a positive number')).not.toBeInTheDocument()
  })
})

describe('SegmentedControl', () => {
  it('exposes radio semantics and reports the selected option', async () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Chart range"
        value="1y"
        onChange={onChange}
        options={[
          { value: '1m', label: '1M' },
          { value: '1y', label: '1Y' },
        ]}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: 'Chart range' })
    expect(within(group).getByRole('radio', { name: '1Y' })).toBeChecked()
    expect(within(group).getByRole('radio', { name: '1M' })).not.toBeChecked()

    await userEvent.click(within(group).getByRole('radio', { name: '1M' }))
    expect(onChange).toHaveBeenCalledWith('1m')
  })
})

describe('Modal', () => {
  it('is a labelled modal dialog and closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Modal title="Record payment" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Record payment' })).toHaveAttribute(
      'aria-modal',
      'true',
    )

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on Escape while closing is disabled', async () => {
    const onClose = vi.fn()
    render(
      <Modal title="Importing" onClose={onClose} isCloseDisabled>
        <p>Body</p>
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  })
})

describe('Table', () => {
  it('reports sort state via aria-sort and fires onSort', async () => {
    const onSort = vi.fn()
    render(
      <Table label="Transactions">
        <TableHead>
          <TableRow>
            <TableHeaderCell sort={{ direction: 'desc', onSort }}>Date</TableHeaderCell>
            <TableHeaderCell>Description</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>2026-07-01</TableCell>
            <TableCell numeric>12.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const sorted = screen.getByRole('columnheader', { name: /Date/ })
    expect(sorted).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByRole('columnheader', { name: 'Description' })).not.toHaveAttribute(
      'aria-sort',
    )

    await userEvent.click(screen.getByRole('button', { name: /Date/ }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('makes a clickable row keyboard-activatable', async () => {
    const onClick = vi.fn()
    render(
      <Table label="Transactions">
        <TableBody>
          <TableRow onClick={onClick}>
            <TableCell>Rent</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const row = screen.getByRole('row')
    expect(row).toHaveAttribute('tabindex', '0')

    row.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('presentational primitives', () => {
  it('Badge renders its text verbatim, without capitalisation', () => {
    render(<Badge tone="positive">ActivoBank</Badge>)
    expect(screen.getByText('ActivoBank')).toBeInTheDocument()
  })

  it('Card renders the requested element with padding and elevation classes', () => {
    render(
      <Card as="section" padding="lg" elevation="floating" aria-label="Summary">
        content
      </Card>,
    )
    const card = screen.getByLabelText('Summary')
    expect(card.tagName).toBe('SECTION')
    expect(card.className).toContain('ui-card-pad-lg')
    expect(card.className).toContain('ui-card-floating')
  })

  it('EmptyState surfaces a title and an action', () => {
    render(
      <EmptyState
        title="No transactions yet"
        description="Import a statement to get started."
        action={<Button>Import</Button>}
      />,
    )
    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })

  it('Skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('PageHeader renders the title as the page heading', () => {
    render(<PageHeader title="Wealth" eyebrow="July 2026" actions={<Button>Add</Button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Wealth' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})
