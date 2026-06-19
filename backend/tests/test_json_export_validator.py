import json

from scripts.validate_json_export import REQUIRED_TABLES, load_json_file, validate_export


def build_valid_export():
    return {
        "format_version": 1,
        "user_id": "user@example.com",
        "email": "user@example.com",
        "tables": {table_name: [] for table_name in REQUIRED_TABLES},
    }


def test_validate_export_accepts_valid_export():
    issues = validate_export(build_valid_export())

    assert issues == []


def test_validate_export_requires_object_root():
    issues = validate_export([])

    assert issues[0].message == "Export root must be a JSON object."


def test_validate_export_requires_format_version_one():
    data = build_valid_export()
    data["format_version"] = 2

    issues = validate_export(data)

    assert "format_version must be 1." in [issue.message for issue in issues]


def test_validate_export_requires_user_id():
    data = build_valid_export()
    data["user_id"] = ""

    issues = validate_export(data)

    assert "user_id must be a non-empty string." in [issue.message for issue in issues]


def test_validate_export_requires_email_field():
    data = build_valid_export()
    del data["email"]

    issues = validate_export(data)

    assert "email field is missing." in [issue.message for issue in issues]


def test_validate_export_requires_tables_object():
    data = build_valid_export()
    data["tables"] = []

    issues = validate_export(data)

    assert "tables must be a JSON object." in [issue.message for issue in issues]


def test_validate_export_requires_all_tables():
    data = build_valid_export()
    del data["tables"]["transactions"]

    issues = validate_export(data)

    assert "Missing required table: transactions." in [issue.message for issue in issues]


def test_validate_export_requires_table_rows_to_be_lists():
    data = build_valid_export()
    data["tables"]["transactions"] = {}

    issues = validate_export(data)

    assert "Table transactions must be a list." in [issue.message for issue in issues]


def test_validate_export_requires_rows_to_be_objects():
    data = build_valid_export()
    data["tables"]["transactions"] = ["bad-row"]

    issues = validate_export(data)

    assert "Row 0 in table transactions must be an object." in [
        issue.message for issue in issues
    ]


def test_load_json_file_reads_valid_json(tmp_path):
    path = tmp_path / "export.json"
    path.write_text(json.dumps(build_valid_export()))

    data = load_json_file(path)

    assert data["format_version"] == 1
