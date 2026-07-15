import os
import subprocess
import sys
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine, text

import app.models  # noqa: F401
from app.database import Base
from app.models.import_batch import ImportBatch
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from scripts.audit_data_integrity import run_audit


def create_test_engine(tmp_path):
    database_path = tmp_path / "audit.db"
    engine = create_engine(f"sqlite:///{database_path}")
    Base.metadata.create_all(bind=engine)
    return engine, database_path


def get_result(results, name: str) -> dict[str, object]:
    for result in results:
        if result["name"] == name:
            return result

    raise AssertionError(f"Missing audit result {name}")


def test_data_integrity_audit_passes_clean_database(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    results = run_audit(engine)

    assert all(result["passed"] for result in results)



def test_data_integrity_audit_detects_invalid_transaction_data(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(text("PRAGMA ignore_check_constraints = ON"))
        connection.execute(
            text(
                """
                INSERT INTO transactions (
                    user_id,
                    date,
                    description,
                    raw_description,
                    amount,
                    direction,
                    cashflow_type,
                    source,
                    currency,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-01',
                    'Bad transaction',
                    'Bad transaction',
                    -1,
                    'sideways',
                    'bad_type',
                    'manual',
                    'EURO',
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )

    results = run_audit(engine)

    assert get_result(results, "transactions_amount_positive")["violations"] == 1
    assert get_result(results, "transactions_direction_known")["violations"] == 1
    assert get_result(results, "transactions_cashflow_type_known")["violations"] == 1
    assert get_result(results, "transactions_currency_codes_valid")["violations"] == 1

def test_data_integrity_audit_detects_broken_relationships(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO owed_payment_allocations (
                    user_id,
                    owed_payment_id,
                    owed_item_id,
                    amount,
                    created_at
                )
                VALUES (
                    'local-default-user',
                    999,
                    999,
                    1,
                    '2026-06-01 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO wealth_snapshots (
                    user_id,
                    snapshot_date,
                    account_id,
                    balance,
                    currency,
                    balance_eur,
                    fx_rate_to_eur,
                    source,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-01',
                    999,
                    100,
                    'EUR',
                    100,
                    1,
                    'manual',
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )

    results = run_audit(engine)

    assert get_result(
        results,
        "owed_payment_allocations_owed_payment_id_not_orphaned",
    )["violations"] == 1
    assert get_result(
        results,
        "owed_payment_allocations_owed_item_id_not_orphaned",
    )["violations"] == 1
    assert get_result(
        results,
        "wealth_snapshots_account_id_not_orphaned",
    )["violations"] == 1



def test_data_integrity_audit_script_exit_code_reflects_failures(tmp_path):
    engine, database_path = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(text("PRAGMA ignore_check_constraints = ON"))
        connection.execute(
            text(
                """
                INSERT INTO transactions (
                    user_id,
                    date,
                    description,
                    raw_description,
                    amount,
                    direction,
                    cashflow_type,
                    source,
                    currency,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-01',
                    'Bad transaction',
                    'Bad transaction',
                    0,
                    'out',
                    'expense',
                    'manual',
                    'EUR',
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )

    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{database_path}"

    result = subprocess.run(
        [sys.executable, "scripts/audit_data_integrity.py"],
        cwd=Path.cwd(),
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 1
    assert "FAIL transactions_amount_positive" in result.stdout

def test_data_integrity_audit_has_no_false_positives_for_valid_rows(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    now = datetime.now(UTC)

    from sqlalchemy.orm import Session

    with Session(engine) as session:
        transaction = Transaction(
            user_id="local-default-user",
            date=date(2026, 6, 1),
            description="Valid transaction",
            raw_description="Valid transaction",
            amount=Decimal("10.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            created_at=now,
            updated_at=now,
        )
        session.add(transaction)

        owed_item = OwedItem(
            user_id="local-default-user",
            person="Mother",
            amount_total=Decimal("10.00"),
            amount_paid=Decimal("4.00"),
            amount_remaining=Decimal("6.00"),
            reason="Valid owed item",
            status="partially_paid",
            source="manual",
            created_at=now,
            updated_at=now,
        )
        session.add(owed_item)

        owed_payment = OwedPayment(
            user_id="local-default-user",
            person="Mother",
            payment_date=date(2026, 6, 1),
            amount=Decimal("4.00"),
            currency="EUR",
            method="cash",
            created_at=now,
            updated_at=now,
        )
        session.add(owed_payment)
        session.flush()

        session.add(
            OwedPaymentAllocation(
                user_id="local-default-user",
                owed_payment_id=owed_payment.id,
                owed_item_id=owed_item.id,
                amount=Decimal("4.00"),
                created_at=now,
            )
        )

        wealth_account = WealthAccount(
            user_id="local-default-user",
            name="Valid account",
            account_type="current_account",
            currency="EUR",
            created_at=now,
            updated_at=now,
        )
        session.add(wealth_account)
        session.flush()

        session.add(
            WealthSnapshot(
                user_id="local-default-user",
                snapshot_date=date(2026, 6, 1),
                account_id=wealth_account.id,
                balance=Decimal("100.00"),
                currency="EUR",
                balance_eur=Decimal("100.00"),
                fx_rate_to_eur=Decimal("1"),
                source="manual",
                created_at=now,
                updated_at=now,
            )
        )

        session.add(
            ImportBatch(
                user_id="local-default-user",
                source="manual",
                filename="valid.csv",
                rows_total=2,
                rows_inserted=1,
                rows_skipped=1,
                status="partial",
                imported_at=now,
            )
        )

        session.commit()

    results = run_audit(engine)

    assert all(result["passed"] for result in results)



def test_data_integrity_audit_allows_zero_wealth_balance(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    now = datetime.now(UTC)

    from sqlalchemy.orm import Session

    with Session(engine) as session:
        wealth_account = WealthAccount(
            user_id="local-default-user",
            name="Zero account",
            account_type="current_account",
            currency="EUR",
            created_at=now,
            updated_at=now,
        )
        session.add(wealth_account)
        session.flush()

        session.add(
            WealthSnapshot(
                user_id="local-default-user",
                snapshot_date=date(2026, 6, 1),
                account_id=wealth_account.id,
                balance=Decimal("0.00"),
                currency="EUR",
                balance_eur=Decimal("0.00"),
                fx_rate_to_eur=Decimal("1"),
                source="manual",
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    results = run_audit(engine)

    assert get_result(results, "wealth_snapshots_amounts_valid")["violations"] == 0

def test_data_integrity_audit_detects_owed_allocation_consistency_issues(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO owed_items (
                    user_id,
                    person,
                    amount_total,
                    amount_paid,
                    amount_remaining,
                    reason,
                    status,
                    source,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    'Mother',
                    10,
                    0,
                    10,
                    'Shared meal',
                    'open',
                    'manual',
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO owed_payments (
                    user_id,
                    person,
                    payment_date,
                    amount,
                    currency,
                    method,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    'Father',
                    '2026-06-02',
                    5,
                    'EUR',
                    'cash',
                    '2026-06-02 00:00:00',
                    '2026-06-02 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO owed_payments (
                    user_id,
                    person,
                    payment_date,
                    amount,
                    currency,
                    method,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    'Mother',
                    '2026-06-03',
                    20,
                    'EUR',
                    'cash',
                    '2026-06-03 00:00:00',
                    '2026-06-03 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO owed_payment_allocations (
                    user_id,
                    owed_payment_id,
                    owed_item_id,
                    amount,
                    created_at
                )
                VALUES
                    ('local-default-user', 1, 1, 6, '2026-06-02 00:00:00'),
                    ('local-default-user', 2, 1, 11, '2026-06-03 00:00:00')
                """
            )
        )

    results = run_audit(engine)

    assert get_result(
        results,
        "owed_allocations_payment_not_over_allocated",
    )["violations"] == 1
    assert get_result(
        results,
        "owed_allocations_item_not_over_allocated",
    )["violations"] == 1
    assert get_result(
        results,
        "owed_allocations_person_matches_payment",
    )["violations"] == 1


def test_data_integrity_audit_detects_invalid_investment_market_events(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO investment_events (
                    user_id,
                    date,
                    source,
                    account,
                    event_type,
                    description,
                    raw_description,
                    amount,
                    currency,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-01',
                    'trading212',
                    'main',
                    'market_buy',
                    'Bad buy',
                    'Bad buy',
                    10,
                    'EUR',
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO investment_events (
                    user_id,
                    date,
                    source,
                    account,
                    event_type,
                    description,
                    raw_description,
                    instrument_name,
                    ticker,
                    isin,
                    quantity,
                    price,
                    amount,
                    currency,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-02',
                    'trading212',
                    'main',
                    'market_buy',
                    'Valid buy',
                    'Valid buy',
                    'ETF',
                    'VWCE',
                    'IE00BK5BQT80',
                    1,
                    100,
                    100,
                    'EUR',
                    '2026-06-02 00:00:00',
                    '2026-06-02 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO investment_events (
                    user_id,
                    date,
                    source,
                    account,
                    event_type,
                    description,
                    raw_description,
                    instrument_name,
                    ticker,
                    isin,
                    quantity,
                    price,
                    amount,
                    currency,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-06-03',
                    'trading212',
                    'main',
                    'market_sell',
                    'Oversold sell',
                    'Oversold sell',
                    'ETF',
                    'VWCE',
                    'IE00BK5BQT80',
                    2,
                    100,
                    200,
                    'EUR',
                    '2026-06-03 00:00:00',
                    '2026-06-03 00:00:00'
                )
                """
            )
        )

    results = run_audit(engine)

    assert get_result(
        results,
        "investment_market_events_required_fields",
    )["violations"] == 1
    assert get_result(
        results,
        "investment_market_sells_not_oversold",
    )["violations"] == 1


def test_data_integrity_audit_detects_wealth_snapshot_consistency_issues(tmp_path):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO wealth_accounts (
                    user_id,
                    name,
                    account_type,
                    currency,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    'Brokerage',
                    'investment',
                    'USD',
                    1,
                    '2026-06-01 00:00:00',
                    '2026-06-01 00:00:00'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO wealth_snapshots (
                    user_id,
                    snapshot_date,
                    account_id,
                    balance,
                    currency,
                    balance_eur,
                    fx_rate_to_eur,
                    source,
                    created_at,
                    updated_at
                )
                VALUES
                    (
                        'local-default-user',
                        '2026-06-01',
                        1,
                        100,
                        'USD',
                        100,
                        1.5,
                        'manual',
                        '2026-06-01 00:00:00',
                        '2026-06-01 00:00:00'
                    ),
                    (
                        'local-default-user',
                        '2026-06-01',
                        1,
                        100,
                        'USD',
                        150,
                        1.5,
                        'manual',
                        '2026-06-01 00:00:00',
                        '2026-06-01 00:00:00'
                    )
                """
            )
        )

    results = run_audit(engine)

    assert get_result(
        results,
        "wealth_snapshots_account_date_unique",
    )["violations"] == 1
    assert get_result(
        results,
        "wealth_snapshots_balance_eur_consistent",
    )["violations"] == 1


def test_data_integrity_audit_covers_all_high_005_relationships(
    tmp_path,
):
    engine, _ = create_test_engine(tmp_path)
    results = run_audit(engine)
    result_names = {
        result["name"]
        for result in results
    }

    relationships = (
        ("transactions", "import_batch_id"),
        ("investment_events", "transaction_id"),
        ("investment_events", "matched_transaction_id"),
        ("investment_events", "import_batch_id"),
        ("owed_items", "linked_transaction_id"),
        ("owed_items", "import_batch_id"),
        ("owed_payments", "linked_transaction_id"),
        (
            "owed_payment_allocations",
            "owed_payment_id",
        ),
        (
            "owed_payment_allocations",
            "owed_item_id",
        ),
        ("wealth_snapshots", "account_id"),
        ("wealth_snapshots", "import_batch_id"),
    )

    for table_name, column_name in relationships:
        prefix = f"{table_name}_{column_name}"

        assert f"{prefix}_not_orphaned" in result_names
        assert f"{prefix}_same_user" in result_names


def test_data_integrity_audit_detects_relationship_ownership(
    tmp_path,
):
    engine, _ = create_test_engine(tmp_path)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO import_batches (
                    id,
                    user_id,
                    source,
                    filename,
                    imported_at,
                    rows_total,
                    rows_inserted,
                    rows_skipped,
                    status
                )
                VALUES (
                    101,
                    'owner-user',
                    'manual',
                    'transactions.csv',
                    CURRENT_TIMESTAMP,
                    1,
                    1,
                    0,
                    'completed'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO transactions (
                    id,
                    user_id,
                    date,
                    description,
                    raw_description,
                    amount,
                    direction,
                    cashflow_type,
                    source,
                    currency,
                    import_batch_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    202,
                    'other-user',
                    '2026-07-14',
                    'Cross-user transaction',
                    'Cross-user transaction',
                    10,
                    'out',
                    'expense',
                    'manual',
                    'EUR',
                    101,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO investment_events (
                    user_id,
                    date,
                    source,
                    event_type,
                    description,
                    raw_description,
                    amount,
                    currency,
                    transaction_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    'local-default-user',
                    '2026-07-14',
                    'manual',
                    'deposit',
                    'Missing transaction',
                    'Missing transaction',
                    10,
                    'EUR',
                    999999,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            )
        )

    results = run_audit(engine)

    assert get_result(
        results,
        "transactions_import_batch_id_same_user",
    )["violations"] == 1
    assert get_result(
        results,
        "investment_events_transaction_id_not_orphaned",
    )["violations"] == 1

