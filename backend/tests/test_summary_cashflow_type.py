from datetime import date

from app.auth.current_user import CurrentUser
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from decimal import Decimal

from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate
from app.services.summary_service import SummaryService
from app.repositories.summary_repository import SummaryRepository


def test_summary_counts_income_and_expense_but_excludes_non_personal_cashflows(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            currency="EUR",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("50.00"),
            direction="out",
            source="manual",
            currency="EUR",
            category="Groceries",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 3),
            description="ActivoBank to Revolut",
            raw_description="TRF P/ REVOLUT",
            amount=Decimal("200.00"),
            direction="out",
            cashflow_type="internal_transfer",
            source="activobank",
            currency="EUR",
            category="Transfers",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 4),
            description="Mother reimbursement",
            raw_description="TRF MOTHER",
            amount=Decimal("65.00"),
            direction="in",
            cashflow_type="reimbursement",
            source="activobank",
            currency="EUR",
            category="Refund",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 5),
            description="Psychologist appointment",
            raw_description="SOFIA PAYMENT",
            amount=Decimal("65.00"),
            direction="out",
            cashflow_type="reimbursed_expense",
            source="activobank",
            currency="EUR",
            category="Health",
        )
    )

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("1000.00")
    assert summary.money_out == Decimal("50.00")
    assert summary.net == Decimal("950.00")
    assert len(summary.top_expense_categories) == 1
    assert summary.top_expense_categories[0].category == "Groceries"
    assert summary.top_expense_categories[0].total == Decimal("50.00")


def test_summary_subtracts_owed_expenses_from_personal_money_out(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    grocery_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("50.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Groceries",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Coffee",
            raw_description="Coffee",
            amount=Decimal("5.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Food",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 3),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("100.00"),
            direction="in",
            cashflow_type="income",
            source="manual",
            currency="EUR",
            category="Salary",
        )
    )

    from app.models.owed_item import OwedItem

    owed_item = OwedItem(
        person="Mother",
        amount_total=Decimal("30.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("30.00"),
        reason="Shared groceries",
        status="open",
        linked_transaction_id=grocery_transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.commit()

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("100.00")
    assert summary.money_out == Decimal("55.00")
    assert summary.owed_expense_amount == Decimal("30.00")
    assert summary.personal_money_out == Decimal("25.00")
    assert summary.net == Decimal("45.00")
    assert summary.personal_net == Decimal("75.00")



def test_summary_is_isolated_by_current_user(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="User one salary",
            raw_description="User one salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            currency="EUR",
        ),
        user_id="user-one",
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="User two salary",
            raw_description="User two salary",
            amount=Decimal("2000.00"),
            direction="in",
            source="manual",
            currency="EUR",
        ),
        user_id="user-two",
    )

    first_summary = service.get_monthly_summary(
        year=2026,
        month=5,
        current_user=CurrentUser(id="user-one"),
    )
    second_summary = service.get_monthly_summary(
        year=2026,
        month=5,
        current_user=CurrentUser(id="user-two"),
    )

    assert first_summary.money_in == Decimal("1000.00")
    assert second_summary.money_in == Decimal("2000.00")

def test_summary_treats_allocated_owed_payment_as_reimbursement_and_extra_as_income(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    pizza_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 10),
            description="Pizza",
            raw_description="Pizza",
            amount=Decimal("29.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Restaurants",
        )
    )
    mbway_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 11),
            description="Grandma MBWay",
            raw_description="Grandma MBWay",
            amount=Decimal("50.00"),
            direction="in",
            cashflow_type="reimbursement",
            source="manual",
            currency="EUR",
            category="Family",
        )
    )

    owed_item = OwedItem(
        person="Grandma",
        amount_total=Decimal("29.00"),
        amount_paid=Decimal("29.00"),
        amount_remaining=Decimal("0.00"),
        reason="Pizza",
        status="paid",
        linked_transaction_id=pizza_transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.flush()

    owed_payment = OwedPayment(
        person="Grandma",
        payment_date=date(2026, 5, 11),
        amount=Decimal("50.00"),
        currency="EUR",
        method="mbway",
        linked_transaction_id=mbway_transaction.id,
        unallocated_category="Allowance",
        unallocated_notes="Grandma gave extra",
    )
    db_session.add(owed_payment)
    db_session.flush()

    allocation = OwedPaymentAllocation(
        owed_payment_id=owed_payment.id,
        owed_item_id=owed_item.id,
        amount=Decimal("29.00"),
    )
    db_session.add(allocation)
    db_session.commit()

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.gross_money_in == Decimal("50.00")
    assert summary.reimbursement_received_amount == Decimal("29.00")
    assert summary.owed_payment_extra_income == Decimal("21.00")
    assert summary.money_in == Decimal("21.00")
    assert summary.money_out == Decimal("29.00")
    assert summary.owed_expense_amount == Decimal("29.00")
    assert summary.personal_money_out == Decimal("0.00")
    assert summary.personal_net == Decimal("21.00")


def test_summary_allows_multiple_people_to_fully_null_shared_expense(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    pharmacy_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 12),
            description="Drugstore",
            raw_description="Drugstore",
            amount=Decimal("40.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Health",
        )
    )

    db_session.add_all(
        [
            OwedItem(
                person="Mother",
                amount_total=Decimal("20.00"),
                amount_paid=Decimal("0.00"),
                amount_remaining=Decimal("20.00"),
                reason="Drugstore",
                status="open",
                linked_transaction_id=pharmacy_transaction.id,
                source="manual",
            ),
            OwedItem(
                person="Father",
                amount_total=Decimal("20.00"),
                amount_paid=Decimal("0.00"),
                amount_remaining=Decimal("20.00"),
                reason="Drugstore",
                status="open",
                linked_transaction_id=pharmacy_transaction.id,
                source="manual",
            ),
        ]
    )
    db_session.commit()

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("0.00")
    assert summary.money_out == Decimal("40.00")
    assert summary.owed_expense_amount == Decimal("40.00")
    assert summary.personal_money_out == Decimal("0.00")
    assert summary.open_owed_amount == Decimal("40.00")
    assert summary.personal_net == Decimal("0.00")

