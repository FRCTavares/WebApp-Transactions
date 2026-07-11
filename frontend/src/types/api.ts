export type Direction = 'in' | 'out'
export type CashflowType = 'income' | 'expense' | 'transfer'

export type TransactionCategory = {
  id: number
  name: string
  direction: Direction
  cashflow_type: CashflowType
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

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
  currency: string
  merchant: string | null
  notes: string | null
  import_batch_id: number | null
  external_id: string | null
  dedupe_hash: string | null
  is_owed: boolean
  owed_item_id: number | null
  owed_status: OwedStatus | null
  owed_person: string | null
  owed_amount_total: string | null
  owed_amount_paid: string | null
  owed_amount_remaining: string | null
  is_owed_payment: boolean
  owed_payment_id: number | null
  owed_payment_person: string | null
  owed_payment_allocated_amount: string | null
  owed_payment_unallocated_amount: string | null
  owed_payment_unallocated_category: string | null
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
  currency?: string
  merchant?: string | null
  notes?: string | null
}

export type MatchedTransaction = {
  id: number
  date: string
  description: string
  amount: string
  currency: string
  account: string | null
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
  matched_transaction: MatchedTransaction | null
  import_batch_id: number | null
  external_id: string | null
  dedupe_hash: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvestmentPositionCost = {
  currency: string
  total_cost: string
  average_price: string
}

export type InvestmentPosition = {
  source: string
  account: string | null
  instrument_name: string | null
  ticker: string | null
  isin: string | null
  quantity: string
  costs: InvestmentPositionCost[]
  market_price: string | null
  market_price_currency: string | null
  market_value: string | null
  market_value_currency: string | null
  market_fx_rate_to_eur: string | null
  unrealised_gain: string | null
  unrealised_gain_percent: string | null
}

export type InvestmentMonthlyChange = {
  month: string
  start_value: string | null
  end_value: string | null
  net_invested: string
  unrealised_monthly_change: string | null
  is_estimated: boolean
}

export type InvestmentMonthlySeriesPoint = {
  month: string
  allocated_eur: string | null
  market_value_eur: string | null
  gain_eur: string | null
  is_estimated: boolean
}

export type InvestmentEventFilters = {
  source?: string
  event_type?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export type MarketPrice = {
  id: number
  ticker: string | null
  isin: string | null
  price: string
  currency: string
  source: string
  fetched_at: string
  created_at: string
  updated_at: string
}

export type MarketPriceCreatePayload = {
  ticker?: string | null
  isin?: string | null
  price: string
  currency: string
  source: string
  fetched_at?: string | null
}

export type MarketPriceUpdatePayload = {
  ticker?: string | null
  isin?: string | null
  price?: string
  currency?: string
  source?: string
  fetched_at?: string | null
}

export type MarketPriceHistory = {
  id: number
  ticker: string | null
  isin: string | null
  price_date: string
  close_price: string
  currency: string
  source: string
  fetched_at: string
  created_at: string
  updated_at: string
}

export type MarketPriceFetchLatestPayload = {
  symbol: string
  ticker?: string | null
  isin?: string | null
  currency?: string | null
}

export type MarketPriceFetchHistoryPayload = {
  symbol: string
  ticker?: string | null
  isin?: string | null
  currency?: string | null
  date_from: string
  date_to: string
}

export type MarketPriceHistoryFilters = {
  ticker?: string
  isin?: string
  date_from?: string
  date_to?: string
  limit?: number
}

export type ManualFundingResolutionPayload = {
  eur_amount: string
  date: string
  description: string
  notes?: string | null
}

export type ManualFundingResolutionResponse = {
  investment_event: InvestmentEvent
  transaction_id: number
}

export type InvestmentFundingMonth = {
  id: number
  month: string
  source: string
  manual_amount: string
  cashback_rounding_amount: string
  currency: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type InvestmentFundingMonthPayload = {
  month: string
  source: string
  manual_amount: string
  cashback_rounding_amount: string
  currency: string
  notes?: string | null
}

export type InvestmentFundingMonthFilters = {
  month?: string
  source?: string
}



export type OwedStatus = 'open' | 'partially_paid' | 'paid' | 'cancelled'
export type OwedStatusFilter = 'active' | OwedStatus

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
  status?: OwedStatusFilter
  person?: string
  limit?: number
  offset?: number
}


export type OwedPaymentMethod = 'cash' | 'bank_transfer' | 'mbway' | 'other'

export type OwedPaymentAllocation = {
  id: number
  owed_payment_id: number
  owed_item_id: number
  amount: string
  created_at: string
}

export type OwedPaymentAllocationCreatePayload = {
  owed_item_id: number
  amount: string
}

export type OwedPayment = {
  id: number
  person: string
  payment_date: string
  amount: string
  currency: string
  method: OwedPaymentMethod
  notes: string | null
  linked_transaction_id: number | null
  unallocated_category: string | null
  unallocated_notes: string | null
  allocated_amount: string
  unallocated_amount: string
  allocations: OwedPaymentAllocation[]
  created_at: string
  updated_at: string
}

export type OwedPaymentCreatePayload = {
  person: string
  payment_date: string
  amount: string
  currency?: string
  method: OwedPaymentMethod
  notes?: string | null
  linked_transaction_id?: number | null
  unallocated_category?: string | null
  unallocated_notes?: string | null
  allocations?: OwedPaymentAllocationCreatePayload[]
}

export type OwedPaymentFilters = {
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
  gross_money_in: string
  money_in: string
  money_out: string
  owed_expense_amount: string
  personal_money_out: string
  reimbursement_received_amount: string
  owed_payment_extra_income: string
  net: string
  personal_net: string
  open_owed_amount: string
  top_expense_categories: CategoryTotal[]
}

export type CategorySummaryItem = {
  category: string
  total: string
  gross_total: string
  owed_total: string
  personal_total: string
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

export type WealthAccountType =
  | 'current_account'
  | 'savings_account'
  | 'brokerage'
  | 'cash'
  | 'other'

export type WealthAccount = {
  id: number
  name: string
  account_type: WealthAccountType
  currency: string
  institution: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type WealthAccountCreatePayload = {
  name: string
  account_type: WealthAccountType
  currency: string
  institution?: string | null
  is_active: boolean
  notes?: string | null
}

export type WealthAccountUpdatePayload = {
  name?: string
  account_type?: WealthAccountType
  currency?: string
  institution?: string | null
  is_active?: boolean
  notes?: string | null
}

export type WealthAccountFilters = {
  active_only?: boolean
  limit?: number
  offset?: number
}

export type WealthSnapshot = {
  id: number
  snapshot_date: string
  account_id: number
  balance: string
  currency: string
  balance_eur: string
  fx_rate_to_eur: string
  interest_earned: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type WealthSnapshotCreatePayload = {
  snapshot_date: string
  account_id: number
  balance: string
  currency: string
  balance_eur?: string | null
  fx_rate_to_eur?: string | null
  interest_earned?: string | null
  notes?: string | null
}

export type WealthSnapshotUpdatePayload = {
  snapshot_date?: string
  account_id?: number
  balance?: string
  currency?: string
  balance_eur?: string | null
  fx_rate_to_eur?: string | null
  interest_earned?: string | null
  notes?: string | null
}

export type WealthSnapshotFilters = {
  account_id?: number
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export type WealthSummary = {
  current_total_wealth_eur: string
  account_count: number
  latest_snapshot_date: string | null
  total_interest_earned: string
  money_owed_to_me_eur: string
  investment_value_eur: string
}

export type WealthMonthlyTotal = {
  month: string
  total_wealth_eur: string
  investment_value_eur: string
}


export type LegacyExcelWealthPreviewSnapshot = {
  sheet_name: string
  row_number: number
  column_number: number
  snapshot_date: string
  account_name: string
  account_type: string
  balance: string
  currency: string
  balance_eur: string
  fx_rate_to_eur: string
  interest_earned: string
  notes: string | null
  external_id: string
  dedupe_hash: string
  is_duplicate: boolean
}

export type LegacyExcelWealthPreviewSummary = {
  snapshot_count: number
  duplicate_snapshot_count: number
  account_count: number
  latest_snapshot_date: string | null
}

export type LegacyExcelWealthPreviewResponse = {
  source: string
  filename: string
  rows_total: number
  rows_valid: number
  rows_duplicates: number
  rows_invalid: number
  summary: LegacyExcelWealthPreviewSummary
  snapshots: LegacyExcelWealthPreviewSnapshot[]
}

export type LegacyExcelWealthCommitResponse = {
  import_batch_id: number
  source: string
  filename: string
  rows_total: number
  rows_inserted: number
  rows_skipped: number
  accounts_created: number
  snapshots_inserted: number
  duplicate_snapshots_skipped: number
  status: string
}
