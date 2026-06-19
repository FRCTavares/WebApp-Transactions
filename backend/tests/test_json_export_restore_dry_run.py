import json

from scripts.restore_json_export_dry_run import run_restore_dry_run
from scripts.validate_json_export import REQUIRED_TABLES


def build_empty_valid_export():
    return {
        "format_version": 1,
        "user_id": "user@example.com",
        "email": "user@example.com",
        "tables": {table_name: [] for table_name in REQUIRED_TABLES},
    }


def test_restore_dry_run_accepts_empty_valid_export(tmp_path):
    export_path = tmp_path / "export.json"
    sqlite_path = tmp_path / "restore.db"
    export_path.write_text(json.dumps(build_empty_valid_export()))

    restored_counts, audit_results = run_restore_dry_run(export_path, sqlite_path)

    assert sqlite_path.exists()
    assert restored_counts["transactions"] == 0
    assert all(result["passed"] for result in audit_results)


def test_restore_dry_run_rejects_invalid_export(tmp_path):
    export_path = tmp_path / "bad-export.json"
    sqlite_path = tmp_path / "restore.db"
    export_path.write_text(json.dumps({"format_version": 1}))

    try:
        run_restore_dry_run(export_path, sqlite_path)
    except ValueError as exc:
        assert "Export validation failed" in str(exc)
    else:
        raise AssertionError("Expected invalid export to fail.")
