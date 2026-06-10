from decimal import Decimal

from app.importers.trading212 import Trading212Importer


def test_trading212_importer_parses_real_export_format():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Spending cashback,2026-05-01 10:00:00,Spending cashback,id-1,0.02,EUR,,,,,,
Spending cashback,2026-05-01 10:05:00,Spending cashback,id-2,0.02,EUR,,,,,,
Card debit,2026-05-01 12:00:00,,id-3,-10.86,EUR,,,,,AUCHAN,Groceries
"""

    importer = Trading212Importer()
    transactions = importer.parse(csv_content)

    assert len(transactions) == 3

    assert transactions[0].description == "Spending cashback"
    assert transactions[0].raw_description == "Spending cashback | ID: id-1"
    assert transactions[0].amount == Decimal("0.02")
    assert transactions[0].direction == "in"
    assert transactions[0].cashflow_type == "income"
    assert transactions[0].external_id == "id-1"

    assert transactions[1].description == "Spending cashback"
    assert transactions[1].raw_description == "Spending cashback | ID: id-2"
    assert transactions[1].amount == Decimal("0.02")
    assert transactions[1].direction == "in"
    assert transactions[1].cashflow_type == "income"
    assert transactions[1].external_id == "id-2"

    assert transactions[2].description == "AUCHAN"
    assert transactions[2].amount == Decimal("10.86")
    assert transactions[2].direction == "out"
    assert transactions[2].cashflow_type == "expense"
    assert transactions[2].external_id == "id-3"


def test_trading212_importer_sets_cashflow_type_for_investment_activity():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Market buy,2026-05-02 10:00:00,Market buy,market-1,12.34,EUR,,,,,,
Bank Transfer,2026-05-02 11:00:00,Bank Transfer,transfer-1,100.00,EUR,,,,,,
Withdrawal,2026-05-02 12:00:00,Withdrawal,withdrawal-1,-50.00,EUR,,,,,,
Bank Transfer,2026-05-02 13:00:00,Transaction ID: ABC123,deposit-1,200.00,EUR,,,,,,
Interest on cash,2026-05-02 14:00:00,Interest on cash,interest-1,0.03,EUR,,,,,,
"""

    importer = Trading212Importer()
    transactions = importer.parse(csv_content)

    assert len(transactions) == 5

    assert transactions[0].description == "Market buy"
    assert transactions[0].direction == "in"
    assert transactions[0].cashflow_type == "investment"

    assert transactions[1].description == "Bank Transfer"
    assert transactions[1].direction == "in"
    assert transactions[1].cashflow_type == "internal_transfer"

    assert transactions[2].description == "Withdrawal"
    assert transactions[2].direction == "out"
    assert transactions[2].cashflow_type == "internal_transfer"

    assert transactions[3].description == "Transaction ID: ABC123"
    assert transactions[3].direction == "in"
    assert transactions[3].cashflow_type == "internal_transfer"

    assert transactions[4].description == "Interest on cash"
    assert transactions[4].direction == "in"
    assert transactions[4].cashflow_type == "income"
