"""add data integrity constraints

Revision ID: 8a1c9d2e4f30
Revises: 3f6ad0b2b5a1
Create Date: 2026-06-19 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "8a1c9d2e4f30"
down_revision: Union[str, Sequence[str], None] = "3f6ad0b2b5a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CONSTRAINTS: list[tuple[str, str, str]] = [
    ("transactions", "ck_transactions_amount_positive", "amount > 0"),
    ("transactions", "ck_transactions_direction_known", "direction IN ('in', 'out')"),
    (
        "transactions",
        "ck_transactions_cashflow_type_known",
        "cashflow_type IN ('income', 'expense', 'internal_transfer', 'investment', 'reimbursement', 'reimbursed_expense')",
    ),
    ("transactions", "ck_transactions_currency_length", "length(currency) = 3"),
    (
        "transactions",
        "ck_transactions_original_currency_length",
        "original_currency IS NULL OR length(original_currency) = 3",
    ),
    ("owed_items", "ck_owed_items_amount_total_positive", "amount_total > 0"),
    ("owed_items", "ck_owed_items_amount_paid_non_negative", "amount_paid >= 0"),
    (
        "owed_items",
        "ck_owed_items_amount_remaining_non_negative",
        "amount_remaining >= 0",
    ),
    (
        "owed_items",
        "ck_owed_items_balance_consistent",
        "abs((amount_paid + amount_remaining) - amount_total) <= 0.01",
    ),
    (
        "owed_items",
        "ck_owed_items_status_known",
        "status IN ('open', 'partially_paid', 'paid', 'cancelled')",
    ),
    ("owed_payments", "ck_owed_payments_amount_positive", "amount > 0"),
    ("owed_payments", "ck_owed_payments_currency_length", "length(currency) = 3"),
    (
        "owed_payments",
        "ck_owed_payments_method_known",
        "method IN ('cash', 'bank_transfer', 'mbway', 'other')",
    ),
    (
        "owed_payment_allocations",
        "ck_owed_payment_allocations_amount_positive",
        "amount > 0",
    ),
    ("investment_events", "ck_investment_events_amount_positive", "amount > 0"),
    ("investment_events", "ck_investment_events_currency_length", "length(currency) = 3"),
    (
        "investment_events",
        "ck_investment_events_original_currency_length",
        "original_currency IS NULL OR length(original_currency) = 3",
    ),
    ("wealth_snapshots", "ck_wealth_snapshots_balance_non_negative", "balance >= 0"),
    (
        "wealth_snapshots",
        "ck_wealth_snapshots_balance_eur_non_negative",
        "balance_eur >= 0",
    ),
    ("wealth_snapshots", "ck_wealth_snapshots_fx_rate_positive", "fx_rate_to_eur > 0"),
    (
        "wealth_snapshots",
        "ck_wealth_snapshots_interest_non_negative",
        "interest_earned IS NULL OR interest_earned >= 0",
    ),
    ("wealth_snapshots", "ck_wealth_snapshots_currency_length", "length(currency) = 3"),
    ("import_batches", "ck_import_batches_rows_total_non_negative", "rows_total >= 0"),
    (
        "import_batches",
        "ck_import_batches_rows_inserted_non_negative",
        "rows_inserted >= 0",
    ),
    (
        "import_batches",
        "ck_import_batches_rows_skipped_non_negative",
        "rows_skipped >= 0",
    ),
    (
        "import_batches",
        "ck_import_batches_counts_consistent",
        "rows_inserted + rows_skipped = rows_total",
    ),
]


def upgrade() -> None:
    constraints_by_table: dict[str, list[tuple[str, str]]] = {}

    for table_name, constraint_name, condition in CONSTRAINTS:
        constraints_by_table.setdefault(table_name, []).append((constraint_name, condition))

    for table_name, table_constraints in constraints_by_table.items():
        with op.batch_alter_table(table_name) as batch_op:
            for constraint_name, condition in table_constraints:
                batch_op.create_check_constraint(constraint_name, condition)


def downgrade() -> None:
    constraints_by_table: dict[str, list[str]] = {}

    for table_name, constraint_name, _condition in reversed(CONSTRAINTS):
        constraints_by_table.setdefault(table_name, []).append(constraint_name)

    for table_name, table_constraints in constraints_by_table.items():
        with op.batch_alter_table(table_name) as batch_op:
            for constraint_name in table_constraints:
                batch_op.drop_constraint(constraint_name, type_="check")
