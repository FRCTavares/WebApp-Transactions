from datetime import date
from decimal import Decimal

from app.repositories.cashflow_rule_repository import CashflowRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.cashflow_rule import CashflowRuleCreate, CashflowRuleUpdate
from app.schemas.transaction import TransactionCreate
from app.services.cashflow_rule_service import CashflowRuleService


def test_cashflow_rule_crud(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="investment",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        )
    )

    assert rule.id is not None
    assert rule.cashflow_type == "investment"

    updated = service.update_rule(
        rule.id,
        CashflowRuleUpdate(
            name="Trading 212 movement",
            cashflow_type="internal_transfer",
        ),
    )

    assert updated.name == "Trading 212 movement"
    assert updated.cashflow_type == "internal_transfer"

    service.delete_rule(rule.id)

    assert repository.get_by_id(rule.id) is None


def test_duplicate_cashflow_rule_is_rejected(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    payload = CashflowRuleCreate(
        name="Trading 212 investment",
        cashflow_type="investment",
        match_text="Trading 212",
        match_field="raw_description",
        direction="out",
        source="activobank",
    )

    service.create_rule(payload)

    try:
        service.create_rule(payload)
    except Exception as error:
        assert "equivalent cashflow rule" in str(error)
    else:
        raise AssertionError("Expected duplicate cashflow rule to be rejected")


def test_apply_cashflow_rule_updates_matching_transactions(db_session):
    transaction_repository = TransactionRepository(db_session)
    rule_repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(
        cashflow_rule_repository=rule_repository,
        transaction_repository=transaction_repository,
    )

    matching_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="COMPRA 8801 Trading 212 Limassol CY",
            raw_description="COMPRA 8801 Trading 212 Limassol CY",
            amount=Decimal("100.00"),
            direction="out",
            source="activobank",
            currency="EUR",
        )
    )

    non_matching_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("25.00"),
            direction="out",
            source="manual",
            currency="EUR",
        )
    )

    service.create_rule(
        CashflowRuleCreate(
            name="Trading 212 investment",
            cashflow_type="investment",
            match_text="Trading 212",
            match_field="raw_description",
            direction="out",
            source="activobank",
        )
    )

    result = service.apply_rules_to_existing_transactions()

    db_session.refresh(matching_transaction)
    db_session.refresh(non_matching_transaction)

    assert result["checked"] == 2
    assert result["updated"] == 1
    assert matching_transaction.cashflow_type == "investment"
    assert non_matching_transaction.cashflow_type == "expense"


def test_cashflow_rules_endpoint_create_and_apply(client):
    create_transaction_response = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-01",
            "description": "COMPRA 8801 Trading 212 Limassol CY",
            "raw_description": "COMPRA 8801 Trading 212 Limassol CY",
            "amount": "100.00",
            "direction": "out",
            "source": "activobank",
            "currency": "EUR",
        },
    )

    assert create_transaction_response.status_code == 201

    create_rule_response = client.post(
        "/api/cashflow-rules",
        json={
            "name": "Trading 212 investment",
            "cashflow_type": "investment",
            "match_text": "Trading 212",
            "match_field": "raw_description",
            "direction": "out",
            "source": "activobank",
            "is_active": True,
        },
    )

    assert create_rule_response.status_code == 201

    apply_response = client.post("/api/cashflow-rules/apply")

    assert apply_response.status_code == 200
    assert apply_response.json()["updated"] == 1

    transactions_response = client.get("/api/transactions?cashflow_type=investment")

    assert transactions_response.status_code == 200
    transactions = transactions_response.json()
    assert len(transactions) == 1
    assert transactions[0]["cashflow_type"] == "investment"


def test_cashflow_rule_can_set_reimbursement_type(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Mother reimbursement",
            cashflow_type="reimbursement",
            match_text="MOTHER",
            match_field="raw_description",
            direction="in",
            source="activobank",
        )
    )

    assert rule.cashflow_type == "reimbursement"


def test_cashflow_rule_can_set_reimbursed_expense_type(db_session):
    repository = CashflowRuleRepository(db_session)
    service = CashflowRuleService(repository)

    rule = service.create_rule(
        CashflowRuleCreate(
            name="Reimbursed health expense",
            cashflow_type="reimbursed_expense",
            match_text="SOFIA",
            match_field="raw_description",
            direction="out",
            source="activobank",
        )
    )

    assert rule.cashflow_type == "reimbursed_expense"
