export type Direction = 'in' | 'out'
export type CashflowType =
  | 'income'
  | 'expense'
  | 'internal_transfer'
  | 'investment'
  | 'reimbursement'
  | 'reimbursed_expense'

export type Transaction = {
  id: number
  date: string
  description: string
  raw_description: string
  amount: string
  direction: Direction
  cashflow_type: CashflowType
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
  cashflow_type?: CashflowType
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
  cashflow_type: CashflowType
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
  cashflow_type?: CashflowType
  source?: string
  account?: string | null
  category?: string | null
  subcategory?: string | null
  currency?: string
  merchant?: string | null
  notes?: string | null
}

export type InvestmentEvent = {
  id: number
  date: string
  source: string
  account: string | null
  event_type: string
  description: string
  raw_description: string
  instrument_name: string | null
  ticker: string | null
  isin: string | null
  quantity: string | null
  price: string | null
  fees: string | null
  taxes: string | null
  amount: string
  currency: string
  original_amount: string | null
  original_currency: string | null
  fx_rate_to_eur: string | null
  fx_rate_source: string | null
  transaction_id: number | null
  funding_source: string | null
  funding_match_status: string | null
  matched_transaction_id: number | null
  import_batch_id: number | null
  external_id: string | null
  dedupe_hash: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvestmentEventFilters = {
  source?: string
  event_type?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
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
  original_amount: string | null
  original_currency: string | null
  fx_rate_to_eur: string | null
  fx_rate_source: string | null
  direction: Direction
  cashflow_type: CashflowType
  source: string
  account: string | null
  currency: string
  external_id: string | null
  notes: string | null
  dedupe_hash: string
  is_duplicate: boolean
  category: string | null
}

export type ImportPreviewInvestmentEvent = {
  row_number: number
  date: string
  source: string
  account: string | null
  event_type: string
  description: string
  raw_description: string
  amount: string
  currency: string
  instrument_name: string | null
  ticker: string | null
  isin: string | null
  quantity: string | null
  price: string | null
  fees: string | null
  taxes: string | null
  original_amount: string | null
  original_currency: string | null
  fx_rate_to_eur: string | null
  fx_rate_source: string | null
  transaction_id: number | null
  funding_source: string | null
  funding_match_status: string | null
  matched_transaction_id: number | null
  external_id: string | null
  notes: string | null
  dedupe_hash: string
  is_duplicate: boolean
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
  investment_events: ImportPreviewInvestmentEvent[]
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



export type CashflowRule = {
  id: number
  name: string
  cashflow_type: CashflowType
  match_text: string
  match_field: 'description' | 'raw_description' | 'merchant'
  direction: Direction | null
  source: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
