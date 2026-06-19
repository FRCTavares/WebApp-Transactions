from sqlalchemy import CheckConstraint

from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.models.wealth_snapshot import WealthSnapshot


def constraint_names(model: object) -> set[str]:
    return {
        constraint.name
        for constraint in model.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }


def test_transaction_check_constraints_are_registered():
    assert {
        "ck_transactions_amount_positive",
        "ck_transactions_direction_known",
        "ck_transactions_cashflow_type_known",
        "ck_transactions_currency_length",
        "ck_transactions_original_currency_length",
    }.issubset(constraint_names(Transaction))


def test_owed_item_check_constraints_are_registered():
    assert {
        "ck_owed_items_amount_total_positive",
        "ck_owed_items_amount_paid_non_negative",
        "ck_owed_items_amount_remaining_non_negative",
        "ck_owed_items_balance_consistent",
        "ck_owed_items_status_known",
    }.issubset(constraint_names(OwedItem))


def test_owed_payment_check_constraints_are_registered():
    assert {
        "ck_owed_payments_amount_positive",
        "ck_owed_payments_currency_length",
        "ck_owed_payments_method_known",
    }.issubset(constraint_names(OwedPayment))


def test_owed_payment_allocation_check_constraints_are_registered():
    assert {
        "ck_owed_payment_allocations_amount_positive",
    }.issubset(constraint_names(OwedPaymentAllocation))


def test_investment_event_check_constraints_are_registered():
    assert {
        "ck_investment_events_amount_positive",
        "ck_investment_events_currency_length",
        "ck_investment_events_original_currency_length",
    }.issubset(constraint_names(InvestmentEvent))


def test_wealth_snapshot_check_constraints_are_registered():
    assert {
        "ck_wealth_snapshots_balance_non_negative",
        "ck_wealth_snapshots_balance_eur_non_negative",
        "ck_wealth_snapshots_fx_rate_positive",
        "ck_wealth_snapshots_interest_non_negative",
        "ck_wealth_snapshots_currency_length",
    }.issubset(constraint_names(WealthSnapshot))


def test_import_batch_check_constraints_are_registered():
    assert {
        "ck_import_batches_rows_total_non_negative",
        "ck_import_batches_rows_inserted_non_negative",
        "ck_import_batches_rows_skipped_non_negative",
        "ck_import_batches_counts_consistent",
    }.issubset(constraint_names(ImportBatch))
