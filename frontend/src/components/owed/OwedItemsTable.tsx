import { ChevronDown, HandCoins } from 'lucide-react'
import type { OwedItem, Transaction } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import { Badge, Button, EmptyState } from '../ui'
import type { BadgeTone } from '../ui'

import { OwedInlineForm } from './OwedInlineForm'
import type { OwedFormState } from './OwedInlineForm'

export type { OwedFormState } from './OwedInlineForm'

function getPersonGroups(items: OwedItem[]) {
  const groups = new Map<string, OwedItem[]>()

  for (const item of items) {
    const currentItems = groups.get(item.person) ?? []
    currentItems.push(item)
    groups.set(item.person, currentItems)
  }

  return [...groups.entries()]
    .map(([person, personItems]) => ({
      person,
      items: personItems,
      totalRemaining: personItems.reduce(
        (total, item) => total + Number(item.amount_remaining),
        0,
      ),
    }))
    .sort((firstGroup, secondGroup) => {
      const totalDifference = secondGroup.totalRemaining - firstGroup.totalRemaining

      if (totalDifference !== 0) {
        return totalDifference
      }

      return firstGroup.person.localeCompare(secondGroup.person)
    })
}

/* Tones mirror the meaning the old per-status badge classes carried: settled
   is positive, anything overdue or partially paid still needs attention, and
   cancelled is simply inactive. */
function getStatusTone(item: OwedItem): BadgeTone {
  if (item.status === 'paid') {
    return 'positive'
  }

  if (item.status === 'cancelled') {
    return 'neutral'
  }

  if (
    item.due_date
    && item.due_date < new Date().toISOString().slice(0, 10)
  ) {
    return 'negative'
  }

  return 'warning'
}

function getStatusLabel(item: OwedItem) {
  if (
    item.due_date
    && item.due_date < new Date().toISOString().slice(0, 10)
    && item.status !== 'paid'
    && item.status !== 'cancelled'
  ) {
    return item.status === 'partially_paid' ? 'overdue · part paid' : 'overdue'
  }

  if (item.status === 'partially_paid') {
    return 'part paid'
  }

  return item.status.replaceAll('_', ' ')
}


type OwedItemsTableProps = {
  items: OwedItem[]
  linkedTransactions: Transaction[]
  isCreateRowOpen: boolean
  form: OwedFormState
  editForm: OwedFormState
  editingItem: OwedItem | null
  onCreateItem: () => void
  onStartEdit: (item: OwedItem) => void
  onSaveEdit: () => void
  onMarkPaid: (item: OwedItem) => void
  onDelete: (item: OwedItem) => void
  onFormChange: (field: keyof OwedFormState, value: string) => void
  onEditFormChange: (field: keyof OwedFormState, value: string) => void
  onLinkedTransactionChange: (transactionId: string) => void
  onEditLinkedTransactionChange: (transactionId: string) => void
  onCancelCreate: () => void
  onCancelEdit: () => void
  formatLinkedTransactionOption: (transaction: Transaction) => string
}

export function OwedItemsTable({
  items,
  linkedTransactions,
  isCreateRowOpen,
  form,
  editForm,
  editingItem,
  onCreateItem,
  onStartEdit,
  onSaveEdit,
  onMarkPaid,
  onDelete,
  onFormChange,
  onEditFormChange,
  onLinkedTransactionChange,
  onEditLinkedTransactionChange,
  onCancelCreate,
  onCancelEdit,
  formatLinkedTransactionOption,
}: OwedItemsTableProps) {
  const shouldShowFlatTable = isCreateRowOpen || Boolean(editingItem)
  const personGroups = getPersonGroups(items)

  return (
    <>
      {!shouldShowFlatTable && (
        <div className="owed-person-groups owed-mobile-groups">
          {personGroups.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No owed items in this view"
              description="Add a new item when someone owes you money, or switch the view filter."
            />
          ) : (
            personGroups.map((group, groupIndex) => (
              <article key={group.person} className="owed-person-card">
                <div className="owed-person-card-header">
                  <div>
                    <h2>{group.person}</h2>
                    <p className="muted small">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <strong>{formatMoney(group.totalRemaining.toFixed(2))}</strong>
                </div>

                {(personGroups.length > 1 || group.items.length > 5) && (
                  <div className="owed-person-card-hint">
                    {personGroups.length > 1 && (
                      <span>{groupIndex + 1} of {personGroups.length} · swipe sideways</span>
                    )}
                    {group.items.length > 5 && (
                      <span>{group.items.length} items · scroll list</span>
                    )}
                  </div>
                )}

                <div className="owed-person-card-columns" aria-hidden="true">
                  <span>Description</span>
                  <span>Status</span>
                  <span>Paid</span>
                  <span>Remaining</span>
                </div>

                <div className="owed-person-items">
                  {group.items.map((item) => (
                    <details key={item.id} className="owed-person-item">
                      <summary className="owed-person-item-summary">
                        <span className="owed-person-item-title">{item.reason}</span>
                        <Badge
                          tone={getStatusTone(item)}
                          size="sm"
                          className="owed-person-item-status-compact"
                        >
                          {getStatusLabel(item)}
                        </Badge>
                        <span className="owed-person-item-paid">
                          {formatMoney(item.amount_paid)}
                        </span>
                        <span className="owed-person-item-amount">
                          {formatMoney(item.amount_remaining)}
                        </span>
                        <span className="owed-person-item-more">
                          <span className="ui-visually-hidden">Details</span>
                          <ChevronDown
                            className="owed-person-item-chevron"
                            size={16}
                            aria-hidden="true"
                          />
                        </span>
                      </summary>

                      <div className="owed-person-item-details">
                        <div className="owed-person-item-status-row">
                          <Badge tone={getStatusTone(item)} size="sm">
                            {getStatusLabel(item)}
                          </Badge>
                          {item.due_date && (
                            <span className="muted small">Due {formatDate(item.due_date)}</span>
                          )}
                          {item.amount_paid !== '0.00' && (
                            <span className="muted small">
                              Paid {formatMoney(item.amount_paid)}
                            </span>
                          )}
                        </div>

                        {item.notes && <p className="muted small">{item.notes}</p>}

                        <div className="owed-person-item-actions">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onStartEdit(item)}
                            aria-label={`Edit ${item.reason}`}
                          >
                            Edit
                          </Button>
                          {item.status !== 'paid' && item.status !== 'cancelled' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onMarkPaid(item)}
                              aria-label={`Mark ${item.reason} as paid`}
                            >
                              Paid
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => onDelete(item)}
                            aria-label={`Delete ${item.reason}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      <div className={`content-card table-wrap owed-table-wrap owed-desktop-table-wrap ${shouldShowFlatTable ? 'owed-table-has-inline-form' : 'owed-flat-table-hidden'}`}>
        <table className="owed-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Description</th>
            <th>Status</th>
            <th>Due</th>
            <th>Linked Tx</th>
            <th className="right">Total</th>
            <th className="right">Paid</th>
            <th className="right">Remaining</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isCreateRowOpen && (
            <tr className="inline-create-row">
              <td colSpan={9}>
                <OwedInlineForm
                  form={form}
                  onChange={onFormChange}
                  onLinkedTransactionChange={onLinkedTransactionChange}
                  linkedTransactions={linkedTransactions}
                  formatLinkedTransactionOption={formatLinkedTransactionOption}
                  onSave={onCreateItem}
                  onCancel={onCancelCreate}
                  status={<Badge tone="warning" size="sm">open</Badge>}
                  saveLabel="Save"
                />
              </td>
            </tr>
          )}

          {items.length === 0 && !isCreateRowOpen ? (
            <tr>
              <td colSpan={9}>
                <EmptyState
                  icon={HandCoins}
                  title="No owed items in this view"
                  description="Add a new item when someone owes you money, or switch the view or status filters."
                />
              </td>
            </tr>
          ) : (
            items.map((item) => (
              editingItem?.id === item.id ? (
                <tr key={item.id} className="inline-edit-row">
                  <td colSpan={9}>
                    <OwedInlineForm
                      form={editForm}
                      onChange={onEditFormChange}
                      onLinkedTransactionChange={onEditLinkedTransactionChange}
                      linkedTransactions={linkedTransactions}
                      formatLinkedTransactionOption={formatLinkedTransactionOption}
                      onSave={onSaveEdit}
                      onCancel={onCancelEdit}
                      labelPrefix="Edit"
                      status={(
                        <Badge tone={getStatusTone(item)} size="sm">
                          {getStatusLabel(item)}
                        </Badge>
                      )}
                      saveLabel="Save"
                    />
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.person}</td>
                  <td>
                    <div>{item.reason}</div>
                    {item.notes && <div className="muted small">{item.notes}</div>}
                  </td>
                  <td>
                    <Badge tone={getStatusTone(item)} size="sm">
                      {getStatusLabel(item)}
                    </Badge>
                  </td>
                  <td>{formatDate(item.due_date)}</td>
                  <td>{item.linked_transaction_id ?? '-'}</td>
                  <td className="right">{formatMoney(item.amount_total)}</td>
                  <td className="right">{formatMoney(item.amount_paid)}</td>
                  <td className="right">{formatMoney(item.amount_remaining)}</td>
                  <td>
                    <div className="action-group">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onStartEdit(item)}
                        aria-label={`Edit ${item.reason}`}
                      >
                        Edit
                      </Button>
                      {item.status !== 'paid' && item.status !== 'cancelled' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onMarkPaid(item)}
                          aria-label={`Mark ${item.reason} as paid`}
                        >
                          Mark Paid
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(item)}
                        aria-label={`Delete ${item.reason}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  )
}
