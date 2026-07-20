import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import './Table.css'

export type SortDirection = 'asc' | 'desc'

export type TableProps = {
  /** Accessible name for the table, e.g. "Transactions". */
  label: string
  /** Minimum width before horizontal scrolling kicks in. */
  minWidth?: string
  /**
   * Constrains height so `position: sticky` on the header actually works.
   * Without it the header cannot stick - the old `.table-wrap` set
   * `overflow-x: auto` with no height, so its sticky header never worked.
   */
  maxHeight?: string
  children: ReactNode
}

export function Table({ label, minWidth = '48rem', maxHeight, children }: TableProps) {
  return (
    <div
      className={`ui-table-wrap${maxHeight ? ' ui-table-sticky' : ''}`}
      style={{ maxHeight }}
      /* Focusable so a keyboard user can scroll a wide table. */
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="ui-table" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="ui-table-head">{children}</thead>
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export type TableRowProps = {
  onClick?: () => void
  /** Visually de-emphasises the row without hiding it. */
  muted?: boolean
  children: ReactNode
}

export function TableRow({ onClick, muted = false, children }: TableRowProps) {
  const classes = [onClick ? 'ui-table-row-clickable' : '', muted ? 'is-muted' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <tr
      className={classes || undefined}
      onClick={onClick}
      /* A clickable row must also be reachable and activatable by keyboard.
         The old `.clickable-row` was mouse-only. */
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </tr>
  )
}

export type TableHeaderCellProps = {
  align?: 'left' | 'right'
  /** Omit to render a plain, non-sortable header. */
  sort?: {
    direction: SortDirection | null
    onSort: () => void
  }
  children: ReactNode
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'className' | 'align'>

export function TableHeaderCell({
  align = 'left',
  sort,
  children,
  ...rest
}: TableHeaderCellProps) {
  if (!sort) {
    return (
      <th {...rest} className={`ui-table-th ui-table-${align}`}>
        {children}
      </th>
    )
  }

  const SortIcon =
    sort.direction === 'asc' ? ArrowUp : sort.direction === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <th
      {...rest}
      className={`ui-table-th ui-table-${align}`}
      aria-sort={
        sort.direction === 'asc'
          ? 'ascending'
          : sort.direction === 'desc'
            ? 'descending'
            : 'none'
      }
    >
      <button type="button" className="ui-table-sort" onClick={sort.onSort}>
        <span>{children}</span>
        <SortIcon size={13} aria-hidden="true" />
      </button>
    </th>
  )
}

export type TableCellProps = {
  align?: 'left' | 'right'
  /** Tabular figures, so decimal points line up down the column. */
  numeric?: boolean
  children: ReactNode
} & Omit<TdHTMLAttributes<HTMLTableCellElement>, 'className' | 'align'>

export function TableCell({
  align = 'left',
  numeric = false,
  children,
  ...rest
}: TableCellProps) {
  const classes = ['ui-table-td', `ui-table-${align}`, numeric ? 'ui-table-numeric' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <td {...rest} className={classes}>
      {children}
    </td>
  )
}

/** Full-width row for empty, loading or error states inside a table body. */
export function TableMessageRow({
  colSpan,
  children,
}: {
  colSpan: number
  children: ReactNode
}) {
  return (
    <tr>
      <td className="ui-table-message" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  )
}
