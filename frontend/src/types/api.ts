export type Direction = 'in' | 'out'

export type Transaction = {
  id: number
  date: string
  description: string
  raw_description: string
  amount: string
  direction: Direction
  source: string
  account: string | null
  category: string | null
  subcategory: string | null
  currency: string
  merchant: string | null
  notes: string | null
  import_batch_id: number | null
  external_id: string | null
  dedupe_hash: string | null
  created_at: string
  updated_at: string
}

export type TransactionFilters = {
  direction?: Direction
  category?: string
  source?: string
  date_from?: string
  date_to?: string
  search?: string
  limit?: number
  offset?: number
}

export type TransactionCreatePayload = {
  date: string
  description: string
  raw_description: string
  amount: string
  direction: Direction
  source: string
  account?: string | null
  category?: string | null
  subcategory?: string | null
  currency: string
  merchant?: string | null
  notes?: string | null
}

export type TransactionUpdatePayload = {
  date?: string
  description?: string
  raw_description?: string
  amount?: string
  direction?: Direction
  source?: string
  account?: string | null
  category?: string | null
  subcategory?: string | null
  currency?: string
  merchant?: string | null
  notes?: string | null
}

export type OwedStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'

export type OwedItem = {
  id: number
  person: string
  amount_total: string
  amount_paid: string
  amount_remaining: string
  reason: string
  status: OwedStatus
  due_date: string | null
  linked_transaction_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type OwedItemCreatePayload = {
  person: string
  amount_total: string
  amount_paid?: string
  reason: string
  status?: OwedStatus
  due_date?: string | null
  linked_transaction_id?: number | null
  notes?: string | null
}

export type OwedItemUpdatePayload = {
  person?: string
  amount_total?: string
  amount_paid?: string
  reason?: string
  status?: OwedStatus
  due_date?: string | null
  linked_transaction_id?: number | null
  notes?: string | null
}

export type OwedItemFilters = {
  status?: OwedStatus
  person?: string
  limit?: number
  offset?: number
}

export type CategoryTotal = {
  category: string
  total: string
}

export type MonthlySummary = {
  month: string
  money_in: string
  money_out: string
  net: string
  open_owed_amount: string
  top_expense_categories: CategoryTotal[]
}

export type CategorySummaryItem = {
  category: string
  subcategory: string | null
  total: string
  count: number
}

export type CategorySummaryResponse = {
  year: number | null
  month: number | null
  direction: Direction | null
  items: CategorySummaryItem[]
}

export type ImportPreviewTransaction = {
  row_number: number
  date: string
  raw_description: string
  description: string
  amount: string
  direction: Direction
  source: string
  account: string | null
  currency: string
  external_id: string | null
  notes: string | null
  dedupe_hash: string
  is_duplicate: boolean
  category: string | null
}

export type ImportInvalidRow = {
  row_number: number
  error: string
}

export type ImportPreviewResponse = {
  source: string
  rows_total: number
  rows_valid: number
  rows_duplicates: number
  rows_invalid: number
  transactions: ImportPreviewTransaction[]
  invalid_rows: ImportInvalidRow[]
}

export type ImportBatch = {
  id: number
  source: string
  filename: string
  imported_at: string
  rows_total: number
  rows_inserted: number
  rows_skipped: number
  status: string
}

export type CategoryRule = {
  id: number
  name: string
  category: string
  subcategory: string | null
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction: Direction | null
  source: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CategoryRuleSuggestion = {
  description: string
  source: string
  direction: Direction
  count: number
  total: string
}

export type DescriptionRule = {
  id: number
  name: string
  cleaned_description: string
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction: Direction | null
  source: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type DescriptionRuleSuggestion = {
  raw_description: string
  description: string
  source: string
  direction: Direction
  count: number
  total: string
}

