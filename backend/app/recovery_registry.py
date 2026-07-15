from dataclasses import dataclass

from app.models.cashflow_rule import CashflowRule
from app.models.description_rule import DescriptionRule
from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.investment_funding_month import InvestmentFundingMonth
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.models.transaction_category import TransactionCategory
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


EXPORT_FORMAT_VERSION = 3

NON_RECOVERABLE_USER_TABLE_NAMES = (
    "import_previews",
)


@dataclass(frozen=True)
class UserRecoveryTable:
    name: str
    model: type[object]


USER_RECOVERY_TABLES = (
    UserRecoveryTable('import_batches', ImportBatch),
    UserRecoveryTable('transactions', Transaction),
    UserRecoveryTable('transaction_categories', TransactionCategory),
    UserRecoveryTable('wealth_accounts', WealthAccount),
    UserRecoveryTable('owed_items', OwedItem),
    UserRecoveryTable('owed_payments', OwedPayment),
    UserRecoveryTable('owed_item_events', OwedItemEvent),
    UserRecoveryTable(
        'owed_payment_allocations',
        OwedPaymentAllocation,
    ),
    UserRecoveryTable('investment_events', InvestmentEvent),
    UserRecoveryTable(
        'investment_funding_months',
        InvestmentFundingMonth,
    ),
    UserRecoveryTable('wealth_snapshots', WealthSnapshot),
    UserRecoveryTable('cashflow_rules', CashflowRule),
    UserRecoveryTable('description_rules', DescriptionRule),
)


USER_RECOVERY_TABLE_NAMES = tuple(
    table.name for table in USER_RECOVERY_TABLES
)

USER_RECOVERY_MODEL_BY_TABLE = {
    table.name: table.model for table in USER_RECOVERY_TABLES
}


MIGRATION_TABLE_ORDER = (
    'import_batches',
    'import_previews',
    'transactions',
    'transaction_categories',
    'wealth_accounts',
    'owed_items',
    'owed_payments',
    'owed_item_events',
    'owed_payment_allocations',
    'investment_events',
    'investment_funding_months',
    'market_prices',
    'market_price_history',
    'wealth_snapshots',
    'cashflow_rules',
    'description_rules',
)
