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
    assert transactions[0].external_id == "id-1"

    assert transactions[1].description == "Spending cashback"
    assert transactions[1].raw_description == "Spending cashback | ID: id-2"
    assert transactions[1].amount == Decimal("0.02")
    assert transactions[1].direction == "in"
    assert transactions[1].external_id == "id-2"

    assert transactions[2].description == "AUCHAN"
    assert transactions[2].amount == Decimal("10.86")
    assert transactions[2].direction == "out"
    assert transactions[2].external_id == "id-3"
