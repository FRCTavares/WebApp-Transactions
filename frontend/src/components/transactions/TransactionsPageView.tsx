import type { FormEvent } from "react"
import { StatusMessage } from "../StatusMessage"
import { Button, PageHeader, SegmentedControl } from "../ui"
import {
  TransactionFilters,
  type TransactionFilterState,
} from "../TransactionFilters"
import {
  TransactionForm,
  type TransactionFormState,
} from "../TransactionForm"
import {
  TransactionTable,
  type TransactionTableRow,
} from "../TransactionTable"
import type {
  Direction,
  OwedItem,
  Transaction,
  TransactionCategory,
} from "../../types/api"
import { TransactionCreateOwedSection } from "./TransactionCreateOwedSection"
import { TransactionCreateRepaymentSection } from "./TransactionCreateRepaymentSection"
import { TransactionDeleteDialog } from "./TransactionDeleteDialog"
import { TransactionEditDialog } from "./TransactionEditDialog"
import {
  TransactionOwedSplitDialog,
  type OwedSplitRowState,
} from "./TransactionOwedSplitDialog"

export type TransactionsPageViewProps = {
  direction: Direction
  error: string | null
  message: string | null
  dataWarning: string | null
  isTransactionsLoading: boolean
  filters: TransactionFilterState
  categoryOptions: TransactionCategory[]
  form: TransactionFormState
  editForm: TransactionFormState
  transactions: TransactionTableRow[]
  editingTransaction: Transaction | null
  deleteDraftTransaction: Transaction | null
  owedDraftTransaction: TransactionTableRow | null
  isCreateFormOpen: boolean
  isCreateOwedEnabled: boolean
  createOwedRows: OwedSplitRowState[]
  owedPersonOptions: string[]
  isCreateRepaymentEnabled: boolean
  repaymentPerson: string
  repaymentPersonOptions: string[]
  repaymentItems: OwedItem[]
  repaymentAllocations: Record<number, string>
  repaymentUnallocatedCategory: string
  isSavingEdit: boolean
  isDeletingTransaction: boolean
  owedRows: OwedSplitRowState[]
  owedPaymentTransactions: Transaction[]
  owedPaymentAvailableAmounts: Record<number, string>
  owedLeftoverItemsByPerson: Record<string, OwedItem[]>
  isCreatingOwedItem: boolean
  onDirectionChange: (direction: Direction) => void
  onExportCsv: () => void
  onResetCreateForm: () => void
  onSetCreateFormOpen: (isOpen: boolean) => void
  onSetDeleteDraftTransaction: (transaction: Transaction | null) => void
  onFilterChange: (
    field: keyof TransactionFilterState,
    value: string | boolean,
  ) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onCreateSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFormChange: (
    field: keyof TransactionFormState,
    value: string,
  ) => void
  onToggleCreateOwed: (isEnabled: boolean) => void
  onAddCreateOwedRow: () => void
  onRemoveCreateOwedRow: (rowId: string) => void
  onUpdateCreateOwedRow: <K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) => void
  onToggleCreateRepayment: (isEnabled: boolean) => void
  onRepaymentPersonChange: (person: string) => void
  onRepaymentAllocationChange: (
    owedItemId: number,
    amount: string,
  ) => void
  onRepaymentUnallocatedCategoryChange: (category: string) => void
  onStartEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onMarkOwed: (transaction: TransactionTableRow) => void
  onEditFormChange: (
    field: keyof TransactionFormState,
    value: string,
  ) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onCloseOwedDialog: () => void
  onAddOwedRow: () => void
  onRemoveOwedRow: (rowId: string) => void
  onUpdateOwedRow: <K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) => void
  onOwedLeftoverAllocationChange: (
    rowId: string,
    owedItemId: number,
    amount: string,
  ) => void
  onCreateOwedItems: () => void
  getRemainingOwedAmount: (
    transaction: TransactionTableRow,
  ) => number
  getSelectedOwedPaymentTransaction: (
    row: OwedSplitRowState,
  ) => Transaction | null
}

export function TransactionsPageView(props: TransactionsPageViewProps) {
  return (
    <section className={`app-page transactions-page transactions-page-${props.direction}`}>
      <PageHeader
        title={props.direction === 'in' ? 'Money In' : 'Money Out'}
        meta={
          <SegmentedControl
            label="Transaction direction"
            options={[
              { value: 'out', label: 'Money Out' },
              { value: 'in', label: 'Money In' },
            ]}
            value={props.direction}
            onChange={props.onDirectionChange}
            size="sm"
          />
        }
        actions={
          <>
            <span className="desktop-only">
              <Button type="button" onClick={props.onExportCsv}>
                Export CSV
              </Button>
            </span>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (props.isCreateFormOpen) {
                  props.onResetCreateForm()
                  props.onSetCreateFormOpen(false)
                  return
                }
                props.onSetCreateFormOpen(true)
              }}
            >
              {props.isCreateFormOpen ? 'Close' : '+ Add'}
            </Button>
          </>
        }
      />
      <StatusMessage error={props.error} message={props.message} />

      {props.dataWarning && (
        <p className="status status-info" role="status">
          {props.dataWarning}
        </p>
      )}

      <TransactionFilters
        direction={props.direction}
        filters={props.filters}
        categoryOptions={props.categoryOptions}
        onChange={props.onFilterChange}
        onApply={() => props.onApplyFilters()}
        onClear={props.onClearFilters}
      />
      {props.isCreateFormOpen ? (
        <TransactionForm
          title={`Add ${props.direction === 'in' ? 'Money In' : 'Money Out'}`}
          form={props.form}
          submitLabel="Save"
          direction={props.direction}
          onSubmit={props.onCreateSubmit}
          onChange={props.onFormChange}
          categoryOptions={props.categoryOptions}
          onCancel={() => {
            props.onResetCreateForm()
            props.onSetCreateFormOpen(false)
          }}
        >
          {props.direction === 'out' ? (
            <TransactionCreateOwedSection
              isEnabled={props.isCreateOwedEnabled}
              rows={props.createOwedRows}
              transactionAmount={props.form.amount}
              personOptions={props.owedPersonOptions}
              currency="EUR"
              onToggle={props.onToggleCreateOwed}
              onAddRow={props.onAddCreateOwedRow}
              onRemoveRow={props.onRemoveCreateOwedRow}
              onUpdateRow={props.onUpdateCreateOwedRow}
            />
          ) : (
            <TransactionCreateRepaymentSection
              isEnabled={props.isCreateRepaymentEnabled}
              person={props.repaymentPerson}
              personOptions={props.repaymentPersonOptions}
              items={props.repaymentItems}
              allocations={props.repaymentAllocations}
              transactionAmount={props.form.amount}
              unallocatedCategory={props.repaymentUnallocatedCategory}
              currency="EUR"
              onToggle={props.onToggleCreateRepayment}
              onPersonChange={props.onRepaymentPersonChange}
              onAllocationChange={props.onRepaymentAllocationChange}
              onUnallocatedCategoryChange={props.onRepaymentUnallocatedCategoryChange}
            />
          )}
        </TransactionForm>
      ) : null}
      {props.isTransactionsLoading && props.transactions.length === 0 ? (
        <p className="status status-info" role="status" aria-live="polite">
          Loading transactions...
        </p>
      ) : (
        <TransactionTable
          transactions={props.transactions}
          onEdit={props.onStartEdit}
          onDelete={props.onDelete}
          onMarkOwed={props.direction === 'out' ? props.onMarkOwed : undefined}
        />
      )}
      {props.editingTransaction && (
        <TransactionEditDialog
          transaction={props.editingTransaction}
          form={props.editForm}
          categoryOptions={props.categoryOptions}
          isSaving={props.isSavingEdit}
          onChange={props.onEditFormChange}
          onSave={props.onSaveEdit}
          onCancel={props.onCancelEdit}
        />
      )}
      {props.deleteDraftTransaction && (
        <TransactionDeleteDialog
          transaction={props.deleteDraftTransaction}
          isDeleting={props.isDeletingTransaction}
          onCancel={() => props.onSetDeleteDraftTransaction(null)}
          onConfirm={props.onConfirmDelete}
        />
      )}
      {props.owedDraftTransaction && (
        <TransactionOwedSplitDialog
          transaction={props.owedDraftTransaction}
          rows={props.owedRows}
          paymentTransactions={props.owedPaymentTransactions}
          paymentAvailableAmounts={props.owedPaymentAvailableAmounts}
          isCreating={props.isCreatingOwedItem}
          onClose={props.onCloseOwedDialog}
          onAddRow={props.onAddOwedRow}
          onRemoveRow={props.onRemoveOwedRow}
          onUpdateRow={props.onUpdateOwedRow}
          onLeftoverAllocationChange={props.onOwedLeftoverAllocationChange}
          leftoverItemsByPerson={props.owedLeftoverItemsByPerson}
          onCreate={props.onCreateOwedItems}
          getRemainingOwedAmount={props.getRemainingOwedAmount}
          getSelectedPaymentTransaction={props.getSelectedOwedPaymentTransaction}
        />
      )}
    </section>
  )
}
