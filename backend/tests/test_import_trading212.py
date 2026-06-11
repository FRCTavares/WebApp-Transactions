from decimal import Decimal

from app.importers.trading212 import Trading212Importer


def test_trading212_importer_parses_real_export_format():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Spending cashback,2026-05-01 10:00:00,Spending cashback,id-1,0.02,EUR,,,,,,
Spending cashback,2026-05-01 10:05:00,Spending cashback,id-2,0.02,EUR,,,,,,
Card debit,2026-05-01 12:00:00,,id-3,-10.86,EUR,,,,,AUCHAN,Groceries
"""

    importer = Trading212Importer()
    result = importer.parse_full(csv_content)

    assert len(result.transactions) == 3
    assert len(result.investment_events) == 0

    assert result.transactions[0].description == "Spending cashback"
    assert result.transactions[0].raw_description == "Spending cashback | ID: id-1"
    assert result.transactions[0].amount == Decimal("0.02")
    assert result.transactions[0].original_amount == Decimal("0.02")
    assert result.transactions[0].original_currency == "EUR"
    assert result.transactions[0].fx_rate_to_eur == Decimal("1")
    assert result.transactions[0].fx_rate_source == "source_currency"
    assert result.transactions[0].direction == "in"
    assert result.transactions[0].cashflow_type == "income"
    assert result.transactions[0].external_id == "id-1"

    assert result.transactions[1].description == "Spending cashback"
    assert result.transactions[1].raw_description == "Spending cashback | ID: id-2"
    assert result.transactions[1].amount == Decimal("0.02")
    assert result.transactions[1].direction == "in"
    assert result.transactions[1].cashflow_type == "income"
    assert result.transactions[1].external_id == "id-2"

    assert result.transactions[2].description == "AUCHAN"
    assert result.transactions[2].amount == Decimal("10.86")
    assert result.transactions[2].direction == "out"
    assert result.transactions[2].cashflow_type == "expense"
    assert result.transactions[2].external_id == "id-3"


def test_trading212_importer_splits_cash_movements_and_investment_events():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Market buy,2026-05-02 10:00:00,Market buy,market-1,12.34,EUR,,,,,,
Bank Transfer,2026-05-02 11:00:00,Bank Transfer,transfer-1,100.00,EUR,,,,,,
Withdrawal,2026-05-02 12:00:00,Withdrawal,withdrawal-1,-50.00,EUR,,,,,,
Bank Transfer,2026-05-02 13:00:00,Transaction ID: ABC123,deposit-1,200.00,USD,,,,,,
Interest on cash,2026-05-02 14:00:00,Interest on cash,interest-1,0.03,EUR,,,,,,
"""

    importer = Trading212Importer()
    result = importer.parse_full(csv_content)

    assert len(result.transactions) == 3
    assert len(result.investment_events) == 2

    assert result.investment_events[0].description == "Market buy"
    assert result.investment_events[0].event_type == "market_buy"
    assert result.investment_events[0].amount == Decimal("12.34")
    assert result.investment_events[0].currency == "EUR"

    assert result.transactions[0].description == "Bank Transfer"
    assert result.transactions[0].direction == "out"
    assert result.transactions[0].cashflow_type == "investment"

    assert result.transactions[1].description == "Withdrawal"
    assert result.transactions[1].direction == "in"
    assert result.transactions[1].cashflow_type == "investment"

    assert result.transactions[2].description == "Transaction ID: ABC123"
    assert result.transactions[2].direction == "out"
    assert result.transactions[2].cashflow_type == "investment"
    assert result.transactions[2].currency == "USD"
    assert result.transactions[2].original_amount == Decimal("200.00")
    assert result.transactions[2].original_currency == "USD"
    assert result.transactions[2].fx_rate_source == "pending"

    assert result.investment_events[1].description == "Interest on cash"
    assert result.investment_events[1].event_type == "interest"
