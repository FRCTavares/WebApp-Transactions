import type { OwedItem, Transaction } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'

export type OwedFormState = {
  person: string
  reason: string
  amountTotal: string
  amountPaid: string
  dueDate: string
  linkedTransactionId: string
  notes: string
}

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

function getStatusLabel(item: OwedItem) {
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
  const shouldShowTableOnMobile = isCreateRowOpen || Boolean(editingItem)
  const personGroups = getPersonGroups(items)

  return (
    <>
      {!shouldShowTableOnMobile && (
        <div className="owed-mobile-groups">
          {personGroups.length === 0 ? (
            <div className="owed-empty-state owed-mobile-empty">
              <strong>No current owed items</strong>
              <p className="muted">
                Add a new item when someone owes you money.
              </p>
            </div>
          ) : (
            personGroups.map((group) => (
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

                <div className="owed-person-items">
                  {group.items.map((item) => (
                    <article key={item.id} className="owed-person-item">
                      <div className="owed-person-item-main">
                        <div>
                          <strong>{item.reason}</strong>
                          {item.notes && <p className="muted small">{item.notes}</p>}
                        </div>
                        <span>{formatMoney(item.amount_remaining)}</span>
                      </div>

                      <div className="owed-person-item-meta">
                        <span className="badge badge-neutral">{getStatusLabel(item)}</span>
                        {item.due_date && (
                          <span className="muted small">Due {formatDate(item.due_date)}</span>
                        )}
                        {item.amount_paid !== '0.00' && (
                          <span className="muted small">
                            Paid {formatMoney(item.amount_paid)}
                          </span>
                        )}
                      </div>

                      <div className="owed-person-item-actions">
                        <button type="button" onClick={() => onStartEdit(item)}>
                          Edit
                        </button>
                        {item.status !== 'paid' && item.status !== 'cancelled' && (
                          <button type="button" onClick={() => onMarkPaid(item)}>
                            Paid
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => onDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      <div className={`table-wrap owed-table-wrap owed-desktop-table-wrap ${shouldShowTableOnMobile ? 'owed-table-has-inline-form' : ''}`}>
        <table className="owed-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Reason</th>
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
              <td>
                <input
                  className="table-input"
                  value={form.person}
                  onChange={(event) => onFormChange('person', event.target.value)}
                  placeholder="Person"
                />
              </td>
              <td>
                <input
                  className="table-input"
                  value={form.reason}
                  onChange={(event) => onFormChange('reason', event.target.value)}
                  placeholder="Reason"
                />
                <input
                  className="table-input table-input-secondary"
                  value={form.notes}
                  onChange={(event) => onFormChange('notes', event.target.value)}
                  placeholder="Notes"
                />
              </td>
              <td>open</td>
              <td>
                <input
                  className="table-input"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => onFormChange('dueDate', event.target.value)}
                />
              </td>
              <td>
                <select
                  className="table-input"
                  value={form.linkedTransactionId}
                  onChange={(event) => onLinkedTransactionChange(event.target.value)}
                >
                  <option value="">Choose transaction</option>
                  {linkedTransactions.map((transaction) => (
                    <option key={transaction.id} value={transaction.id}>
                      {formatLinkedTransactionOption(transaction)}
                    </option>
                  ))}
                </select>
                <input
                  className="table-input table-input-secondary"
                  type="number"
                  min="1"
                  step="1"
                  value={form.linkedTransactionId}
                  onChange={(event) => onFormChange('linkedTransactionId', event.target.value)}
                  placeholder="Manual Tx ID"
                />
              </td>
              <td className="right">
                <input
                  className="table-input right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountTotal}
                  onChange={(event) => onFormChange('amountTotal', event.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td className="right">
                <input
                  className="table-input right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountPaid}
                  onChange={(event) => onFormChange('amountPaid', event.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td className="right">-</td>
              <td className="actions-cell">
                <div className="table-action-group">
                  <button type="button" className="primary-button" onClick={onCreateItem}>
                    Save
                  </button>
                  <button type="button" onClick={onCancelCreate}>
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}

          {items.length === 0 && !isCreateRowOpen ? (
            <tr>
              <td colSpan={9}>
                <div className="owed-empty-state">
                  <strong>No current owed items</strong>
                  <p className="muted">
                    Add a new item when someone owes you money. Paid legacy history is hidden in the default view.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            items.map((item) => (
              editingItem?.id === item.id ? (
                <tr key={item.id} className="inline-edit-row">
                  <td>
                    <input
                      className="table-input"
                      value={editForm.person}
                      onChange={(event) => onEditFormChange('person', event.target.value)}
                      placeholder="Person"
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={editForm.reason}
                      onChange={(event) => onEditFormChange('reason', event.target.value)}
                      placeholder="Reason"
                    />
                    <input
                      className="table-input table-input-secondary"
                      value={editForm.notes}
                      onChange={(event) => onEditFormChange('notes', event.target.value)}
                      placeholder="Notes"
                    />
                  </td>
                  <td>{item.status}</td>
                  <td>
                    <input
                      className="table-input"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(event) => onEditFormChange('dueDate', event.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={editForm.linkedTransactionId}
                      onChange={(event) => onEditLinkedTransactionChange(event.target.value)}
                    >
                      <option value="">Choose transaction</option>
                      {linkedTransactions.map((transaction) => (
                        <option key={transaction.id} value={transaction.id}>
                          {formatLinkedTransactionOption(transaction)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="table-input table-input-secondary"
                      type="number"
                      min="1"
                      step="1"
                      value={editForm.linkedTransactionId}
                      onChange={(event) => onEditFormChange('linkedTransactionId', event.target.value)}
                      placeholder="Manual Tx ID"
                    />
                  </td>
                  <td className="right">
                    <input
                      className="table-input right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.amountTotal}
                      onChange={(event) => onEditFormChange('amountTotal', event.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="right">
                    <input
                      className="table-input right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.amountPaid}
                      onChange={(event) => onEditFormChange('amountPaid', event.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="right">{formatMoney(item.amount_remaining)}</td>
                  <td className="actions-cell">
                    <div className="table-action-group">
                      <button type="button" className="primary-button" onClick={onSaveEdit}>
                        Save
                      </button>
                      <button type="button" onClick={onCancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.person}</td>
                  <td>
                    <div>{item.reason}</div>
                    {item.notes && <div className="muted small">{item.notes}</div>}
                  </td>
                  <td>{item.status}</td>
                  <td>{formatDate(item.due_date)}</td>
                  <td>{item.linked_transaction_id ?? '-'}</td>
                  <td className="right">{formatMoney(item.amount_total)}</td>
                  <td className="right">{formatMoney(item.amount_paid)}</td>
                  <td className="right">{formatMoney(item.amount_remaining)}</td>
                  <td>
                    <div className="action-group">
                      <button type="button" onClick={() => onStartEdit(item)}>
                        Edit
                      </button>
                      {item.status !== 'paid' && item.status !== 'cancelled' && (
                        <button type="button" onClick={() => onMarkPaid(item)}>
                          Mark Paid
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => onDelete(item)}
                      >
                        Delete
                      </button>
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
