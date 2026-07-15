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


@dataclass(frozen=True)
class RelationshipCheck:
    child_table: str
    child_column: str
    parent_table: str
    parent_column: str = "id"


RELATIONSHIP_CHECKS = (
    RelationshipCheck(
        "transactions",
        "import_batch_id",
        "import_batches",
    ),
    RelationshipCheck(
        "investment_events",
        "transaction_id",
        "transactions",
    ),
    RelationshipCheck(
        "investment_events",
        "matched_transaction_id",
        "transactions",
    ),
    RelationshipCheck(
        "investment_events",
        "import_batch_id",
        "import_batches",
    ),
    RelationshipCheck(
        "owed_items",
        "linked_transaction_id",
        "transactions",
    ),
    RelationshipCheck(
        "owed_items",
        "import_batch_id",
        "import_batches",
    ),
    RelationshipCheck(
        "owed_payments",
        "linked_transaction_id",
        "transactions",
    ),
    RelationshipCheck(
        "owed_payment_allocations",
        "owed_payment_id",
        "owed_payments",
    ),
    RelationshipCheck(
        "owed_payment_allocations",
        "owed_item_id",
        "owed_items",
    ),
    RelationshipCheck(
        "wealth_snapshots",
        "account_id",
        "wealth_accounts",
    ),
    RelationshipCheck(
        "wealth_snapshots",
        "import_batch_id",
        "import_batches",
    ),
)


def build_relationship_checks() -> list[IntegrityCheck]:
    checks: list[IntegrityCheck] = []

    for relationship in RELATIONSHIP_CHECKS:
        relationship_name = (
            f"{relationship.child_table}_"
            f"{relationship.child_column}"
        )

        checks.append(
            IntegrityCheck(
                name=f"{relationship_name}_not_orphaned",
                description=(
                    f"{relationship.child_table}."
                    f"{relationship.child_column} must reference "
                    f"an existing {relationship.parent_table} row."
                ),
                sql=f"""
                    SELECT COUNT(*)
                    FROM {relationship.child_table} AS child
                    LEFT JOIN {relationship.parent_table} AS parent
                      ON parent.{relationship.parent_column}
                       = child.{relationship.child_column}
                    WHERE child.{relationship.child_column} IS NOT NULL
                      AND parent.{relationship.parent_column} IS NULL
                """,
            )
        )
        checks.append(
            IntegrityCheck(
                name=f"{relationship_name}_same_user",
                description=(
                    f"{relationship.child_table}."
                    f"{relationship.child_column} must reference "
                    f"a {relationship.parent_table} row owned by "
                    "the same user."
                ),
                sql=f"""
                    SELECT COUNT(*)
                    FROM {relationship.child_table} AS child
                    JOIN {relationship.parent_table} AS parent
                      ON parent.{relationship.parent_column}
                       = child.{relationship.child_column}
                    WHERE child.{relationship.child_column} IS NOT NULL
                      AND child.user_id != parent.user_id
                """,
            )
        )

    return checks


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
            WHERE cashflow_type NOT IN ('income', 'expense', 'transfer')
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
        name="owed_allocations_payment_not_over_allocated",
        description="Owed payment allocation totals cannot exceed the payment amount.",
        sql="""
            SELECT COUNT(*)
            FROM owed_payments payment
            JOIN (
                SELECT
                    user_id,
                    owed_payment_id,
                    SUM(amount) AS allocated_amount
                FROM owed_payment_allocations
                GROUP BY user_id, owed_payment_id
            ) allocation_total
              ON allocation_total.owed_payment_id = payment.id
             AND allocation_total.user_id = payment.user_id
            WHERE allocation_total.allocated_amount > payment.amount + 0.01
        """,
    ),
    IntegrityCheck(
        name="owed_allocations_item_not_over_allocated",
        description="Owed payment allocation totals cannot exceed the owed item total.",
        sql="""
            SELECT COUNT(*)
            FROM owed_items item
            JOIN (
                SELECT
                    user_id,
                    owed_item_id,
                    SUM(amount) AS allocated_amount
                FROM owed_payment_allocations
                GROUP BY user_id, owed_item_id
            ) allocation_total
              ON allocation_total.owed_item_id = item.id
             AND allocation_total.user_id = item.user_id
            WHERE allocation_total.allocated_amount > item.amount_total + 0.01
        """,
    ),
    IntegrityCheck(
        name="owed_allocations_person_matches_payment",
        description="Owed payment allocations should connect payments and owed items for the same person.",
        sql="""
            SELECT COUNT(*)
            FROM owed_payment_allocations allocation
            JOIN owed_payments payment
              ON payment.id = allocation.owed_payment_id
             AND payment.user_id = allocation.user_id
            JOIN owed_items item
              ON item.id = allocation.owed_item_id
             AND item.user_id = allocation.user_id
            WHERE lower(trim(payment.person)) != lower(trim(item.person))
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
        name="investment_market_events_required_fields",
        description="Investment buy/sell events need quantity, price, and ticker or ISIN.",
        sql="""
            SELECT COUNT(*)
            FROM investment_events
            WHERE event_type IN ('market_buy', 'market_sell')
              AND (
                    quantity IS NULL
                 OR quantity <= 0
                 OR price IS NULL
                 OR price <= 0
                 OR (
                        (ticker IS NULL OR trim(ticker) = '')
                    AND (isin IS NULL OR trim(isin) = '')
                    )
              )
        """,
    ),
    IntegrityCheck(
        name="investment_market_sells_not_oversold",
        description="Investment sell events cannot sell more quantity than prior holdings.",
        sql="""
            SELECT COUNT(*)
            FROM investment_events sell
            WHERE sell.event_type = 'market_sell'
              AND sell.quantity IS NOT NULL
              AND sell.quantity > (
                    SELECT COALESCE(
                        SUM(
                            CASE
                                WHEN prior.event_type = 'market_buy' THEN prior.quantity
                                WHEN prior.event_type = 'market_sell' THEN -prior.quantity
                                ELSE 0
                            END
                        ),
                        0
                    )
                    FROM investment_events prior
                    WHERE prior.user_id = sell.user_id
                      AND prior.source = sell.source
                      AND COALESCE(prior.account, '') = COALESCE(sell.account, '')
                      AND COALESCE(prior.ticker, '') = COALESCE(sell.ticker, '')
                      AND COALESCE(prior.isin, '') = COALESCE(sell.isin, '')
                      AND prior.event_type IN ('market_buy', 'market_sell')
                      AND prior.quantity IS NOT NULL
                      AND (
                            prior.date < sell.date
                         OR (prior.date = sell.date AND prior.id < sell.id)
                      )
              )
        """,
    ),
    IntegrityCheck(
        name="wealth_snapshots_amounts_valid",
        description="Wealth snapshot balances and FX rates must be valid.",
        sql="""
            SELECT COUNT(*) FROM wealth_snapshots
            WHERE balance < 0
               OR balance_eur < 0
               OR fx_rate_to_eur <= 0
               OR interest_earned < 0
        """,
    ),
    IntegrityCheck(
        name="wealth_snapshots_account_date_unique",
        description="There should be at most one wealth snapshot per user, account, and date.",
        sql="""
            SELECT COUNT(*)
            FROM (
                SELECT user_id, account_id, snapshot_date
                FROM wealth_snapshots
                GROUP BY user_id, account_id, snapshot_date
                HAVING COUNT(*) > 1
            ) duplicate_snapshots
        """,
    ),
    IntegrityCheck(
        name="wealth_snapshots_balance_eur_consistent",
        description="Wealth snapshot EUR balance should match balance multiplied by FX rate.",
        sql="""
            SELECT COUNT(*)
            FROM wealth_snapshots
            WHERE abs(balance_eur - (balance * fx_rate_to_eur)) > 0.01
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


CHECKS.extend(build_relationship_checks())


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
