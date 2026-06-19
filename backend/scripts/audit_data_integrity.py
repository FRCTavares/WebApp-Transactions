from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.database import get_database_url, get_engine_kwargs


@dataclass(frozen=True)
class IntegrityCheck:
    name: str
    description: str
    sql: str


CHECKS = [
    IntegrityCheck(
        name="transactions_amount_positive",
        description="Transactions must store positive amounts.",
        sql="""
            SELECT COUNT(*) FROM transactions
            WHERE amount <= 0
        """,
    ),
    IntegrityCheck(
        name="transactions_direction_known",
        description="Transactions direction must be either in or out.",
        sql="""
            SELECT COUNT(*) FROM transactions
            WHERE direction NOT IN ('in', 'out')
        """,
    ),
    IntegrityCheck(
        name="transactions_cashflow_type_known",
        description="Transactions cashflow_type must use a known value.",
        sql="""
            SELECT COUNT(*) FROM transactions
            WHERE cashflow_type NOT IN (
                'income',
                'expense',
                'internal_transfer',
                'investment',
                'reimbursement',
                'reimbursed_expense'
            )
        """,
    ),
    IntegrityCheck(
        name="transactions_currency_codes_valid",
        description="Transaction currency codes must have length 3.",
        sql="""
            SELECT COUNT(*) FROM transactions
            WHERE length(currency) != 3
               OR (original_currency IS NOT NULL AND length(original_currency) != 3)
        """,
    ),
    IntegrityCheck(
        name="owed_items_amounts_valid",
        description="Owed item amounts must be non-negative and total must be positive.",
        sql="""
            SELECT COUNT(*) FROM owed_items
            WHERE amount_total <= 0
               OR amount_paid < 0
               OR amount_remaining < 0
        """,
    ),
    IntegrityCheck(
        name="owed_items_balance_consistent",
        description="Owed item paid plus remaining should match total.",
        sql="""
            SELECT COUNT(*) FROM owed_items
            WHERE abs((amount_paid + amount_remaining) - amount_total) > 0.01
        """,
    ),
    IntegrityCheck(
        name="owed_items_status_known",
        description="Owed item status must use a known value.",
        sql="""
            SELECT COUNT(*) FROM owed_items
            WHERE status NOT IN ('open', 'partially_paid', 'paid', 'cancelled')
        """,
    ),
    IntegrityCheck(
        name="owed_payments_amount_positive",
        description="Owed payments must store positive amounts.",
        sql="""
            SELECT COUNT(*) FROM owed_payments
            WHERE amount <= 0
        """,
    ),
    IntegrityCheck(
        name="owed_payments_method_known",
        description="Owed payment method must use a known value.",
        sql="""
            SELECT COUNT(*) FROM owed_payments
            WHERE method NOT IN ('cash', 'bank_transfer', 'mbway', 'other')
        """,
    ),
    IntegrityCheck(
        name="owed_allocations_amount_positive",
        description="Owed payment allocations must store positive amounts.",
        sql="""
            SELECT COUNT(*) FROM owed_payment_allocations
            WHERE amount <= 0
        """,
    ),
    IntegrityCheck(
        name="owed_allocations_payment_exists",
        description="Owed payment allocations must reference an existing payment for the same user.",
        sql="""
            SELECT COUNT(*)
            FROM owed_payment_allocations allocation
            WHERE NOT EXISTS (
                SELECT 1
                FROM owed_payments payment
                WHERE payment.id = allocation.owed_payment_id
                  AND payment.user_id = allocation.user_id
            )
        """,
    ),
    IntegrityCheck(
        name="owed_allocations_item_exists",
        description="Owed payment allocations must reference an existing owed item for the same user.",
        sql="""
            SELECT COUNT(*)
            FROM owed_payment_allocations allocation
            WHERE NOT EXISTS (
                SELECT 1
                FROM owed_items item
                WHERE item.id = allocation.owed_item_id
                  AND item.user_id = allocation.user_id
            )
        """,
    ),
    IntegrityCheck(
        name="investment_events_amount_positive",
        description="Investment events must store positive amounts.",
        sql="""
            SELECT COUNT(*) FROM investment_events
            WHERE amount <= 0
        """,
    ),
    IntegrityCheck(
        name="investment_events_currency_codes_valid",
        description="Investment event currency codes must have length 3.",
        sql="""
            SELECT COUNT(*) FROM investment_events
            WHERE length(currency) != 3
               OR (original_currency IS NOT NULL AND length(original_currency) != 3)
        """,
    ),
    IntegrityCheck(
        name="wealth_snapshots_amounts_valid",
        description="Wealth snapshot balances and FX rates must be valid.",
        sql="""
            SELECT COUNT(*) FROM wealth_snapshots
            WHERE balance < 0
               OR balance_eur <= 0
               OR fx_rate_to_eur <= 0
               OR interest_earned < 0
        """,
    ),
    IntegrityCheck(
        name="wealth_snapshots_account_exists",
        description="Wealth snapshots must reference an existing wealth account for the same user.",
        sql="""
            SELECT COUNT(*)
            FROM wealth_snapshots snapshot
            WHERE NOT EXISTS (
                SELECT 1
                FROM wealth_accounts account
                WHERE account.id = snapshot.account_id
                  AND account.user_id = snapshot.user_id
            )
        """,
    ),
    IntegrityCheck(
        name="import_batches_counts_valid",
        description="Import batch counters must be non-negative and add up.",
        sql="""
            SELECT COUNT(*) FROM import_batches
            WHERE rows_total < 0
               OR rows_inserted < 0
               OR rows_skipped < 0
               OR rows_inserted + rows_skipped != rows_total
        """,
    ),
]


def create_database_engine() -> Engine:
    database_url = get_database_url()
    return create_engine(
        database_url,
        **get_engine_kwargs(database_url),
    )


def run_audit(engine: Engine) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []

    with engine.connect() as connection:
        for check in CHECKS:
            count = int(connection.scalar(text(check.sql)) or 0)
            results.append(
                {
                    "name": check.name,
                    "description": check.description,
                    "violations": count,
                    "passed": count == 0,
                }
            )

    return results


def print_text_results(results: list[dict[str, object]]) -> None:
    for result in results:
        status = "PASS" if result["passed"] else "FAIL"
        print(f"{status} {result['name']}: {result['violations']} violation(s)")
        if not result["passed"]:
            print(f"  {result['description']}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run read-only data integrity checks.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON output.",
    )
    args = parser.parse_args()

    engine = create_database_engine()
    results = run_audit(engine)

    if args.json:
        print(json.dumps({"checks": results}, indent=2))
    else:
        print_text_results(results)

    failed_checks = [result for result in results if not result["passed"]]
    return 1 if failed_checks else 0


if __name__ == "__main__":
    sys.exit(main())
