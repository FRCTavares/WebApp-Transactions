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


def test_trading212_importer_splits_card_transactions_and_investment_events():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category
Market buy,2026-05-02 10:00:00,Market buy,market-1,12.34,EUR,,,,,,
Bank Transfer,2026-05-02 11:00:00,Bank Transfer,transfer-1,100.00,EUR,,,,,,
Withdrawal,2026-05-02 12:00:00,Withdrawal,withdrawal-1,-50.00,EUR,,,,,,
Bank Transfer,2026-05-02 13:00:00,Transaction ID: ABC123,deposit-1,200.00,USD,,,,,,
Interest on cash,2026-05-02 14:00:00,Interest on cash,interest-1,0.03,EUR,,,,,,
"""

    importer = Trading212Importer()
    result = importer.parse_full(csv_content)

    assert len(result.transactions) == 0
    assert len(result.investment_events) == 5

    assert result.investment_events[0].description == "Market buy"
    assert result.investment_events[0].event_type == "market_buy"
    assert result.investment_events[0].amount == Decimal("12.34")
    assert result.investment_events[0].currency == "EUR"

    assert result.investment_events[1].description == "Bank Transfer"
    assert result.investment_events[1].event_type == "deposit"
    assert result.investment_events[1].funding_source == "activobank"
    assert result.investment_events[1].funding_match_status == "unmatched"

    assert result.investment_events[2].description == "Withdrawal"
    assert result.investment_events[2].event_type == "withdrawal"
    assert result.investment_events[2].funding_source == "activobank"
    assert result.investment_events[2].funding_match_status == "unmatched"

    assert result.investment_events[3].description == "Transaction ID: ABC123"
    assert result.investment_events[3].event_type == "deposit"
    assert result.investment_events[3].currency == "USD"
    assert result.investment_events[3].original_amount == Decimal("200.00")
    assert result.investment_events[3].original_currency == "USD"
    assert result.investment_events[3].fx_rate_source == "pending"
    assert result.investment_events[3].funding_source == "activobank"
    assert result.investment_events[3].funding_match_status == "unmatched"

    assert result.investment_events[4].description == "Interest on cash"
    assert result.investment_events[4].event_type == "interest"

def test_trading212_importer_handles_portuguese_and_crypto_rows():
    csv_content = """Action,Time,Notes,ID,Total,Currency (Total),Charge amount,Currency (Charge amount),Deposit fee,Currency (Deposit fee),Merchant name,Merchant category,Name,Ticker,ISIN,No. of shares,Price / share
Ações compradas,2026-06-01 09:00:00,CSPX buy,pt-market-1,123.45,EUR,,,,,,,iShares Core S&P 500,CSPX,IE00B5BMR087,0.10,1234.50
Juros sobre capital,2026-06-02 09:00:00,Juros sobre capital,pt-interest-1,0.04,EUR,,,,,,,,,,
Compra de cripto,2026-06-03 09:00:00,Bitcoin,btc-buy-1,11.97,EUR,,,,,,,Bitcoin,BTC,,0.00012,99750.00
Débito cartão,2026-06-04 09:00:00,,card-pt-1,-7.50,EUR,,,,,Continente,Groceries,,,,,
Cashback,2026-06-05 09:00:00,Cashback,card-cashback-1,0.01,EUR,,,,,,,,,,
"""

    importer = Trading212Importer()
    result = importer.parse_full(csv_content)

    assert len(result.transactions) == 2
    assert len(result.investment_events) == 3

    assert result.investment_events[0].event_type == "market_buy"
    assert result.investment_events[0].instrument_name == "iShares Core S&P 500"
    assert result.investment_events[0].ticker == "CSPX"
    assert result.investment_events[0].amount == Decimal("123.45")

    assert result.investment_events[1].event_type == "interest"
    assert result.investment_events[1].amount == Decimal("0.04")

    assert result.investment_events[2].event_type == "market_buy"
    assert result.investment_events[2].instrument_name == "Bitcoin"
    assert result.investment_events[2].ticker == "BTC"
    assert result.investment_events[2].amount == Decimal("11.97")

    assert result.transactions[0].description == "Continente"
    assert result.transactions[0].direction == "out"
    assert result.transactions[0].cashflow_type == "expense"
    assert result.transactions[0].amount == Decimal("7.50")

    assert result.transactions[1].description == "Cashback"
    assert result.transactions[1].direction == "in"
    assert result.transactions[1].cashflow_type == "income"
    assert result.transactions[1].amount == Decimal("0.01")

