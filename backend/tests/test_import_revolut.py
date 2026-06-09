from decimal import Decimal

from app.importers.revolut import RevolutImporter


def test_revolut_importer_parses_money_in_and_out():
    csv_content = """Completed Date,Description,Amount,Currency
2026-06-09 10:00:00,Salary,1000.00,EUR
2026-06-09 12:00:00,Groceries,-25.50,EUR
"""

    importer = RevolutImporter()
    transactions = importer.parse(csv_content)

    assert len(transactions) == 2

    assert transactions[0].description == "Salary"
    assert transactions[0].amount == Decimal("1000.00")
    assert transactions[0].direction == "in"
    assert transactions[0].source == "revolut"

    assert transactions[1].description == "Groceries"
    assert transactions[1].amount == Decimal("25.50")
    assert transactions[1].direction == "out"
    assert transactions[1].source == "revolut"
