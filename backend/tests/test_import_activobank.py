from datetime import datetime
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook

from app.importers.activobank import ActivoBankImporter


def test_activobank_importer_parses_excel_export_format():
    workbook = Workbook()
    sheet = workbook.active

    sheet.append(["HISTÓRICO DE CONTA NÚMERO 00000000000", None, None, None, None])
    sheet.append(["Moeda:", "EUR", None, None, None])
    sheet.append(["", "", None, None, None])
    sheet.append(["Tipo:", "Todos", None, None, None])
    sheet.append(["Data de:", datetime(2026, 5, 1), None, None, None])
    sheet.append(["Data até:", datetime(2026, 5, 31), None, None, None])
    sheet.append([None, None, None, None, None])
    sheet.append(["Data Lanc.", "Data Valor", "Descrição", "Valor", "Saldo"])
    sheet.append(
        [
            datetime(2026, 5, 4),
            datetime(2026, 4, 30),
            "TRF. P/O TEST PERSON",
            280,
            485.4,
        ]
    )
    sheet.append(
        [
            datetime(2026, 5, 5),
            datetime(2026, 5, 5),
            "COMPRA 8801 Metropolitano de Lisboa CONTACTLESS",
            -1.92,
            483.48,
        ]
    )

    output = BytesIO()
    workbook.save(output)

    importer = ActivoBankImporter()
    transactions = importer.parse_excel(output.getvalue())

    assert len(transactions) == 2

    assert transactions[0].date.isoformat() == "2026-05-04"
    assert transactions[0].description == "TRF. P/O TEST PERSON"
    assert transactions[0].amount == Decimal("280")
    assert transactions[0].direction == "in"
    assert transactions[0].source == "activobank"
    assert transactions[0].account == "ActivoBank"
    assert transactions[0].currency == "EUR"

    assert transactions[1].date.isoformat() == "2026-05-05"
    assert transactions[1].description == "COMPRA 8801 Metropolitano de Lisboa CONTACTLESS"
    assert transactions[1].amount == Decimal("1.92")
    assert transactions[1].direction == "out"
