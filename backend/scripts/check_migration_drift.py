"""CI safeguard: catch Alembic migrations that outrun the legacy SQLite path.

`app/database_migrations.py` runs at startup against local SQLite databases
that predate the current Alembic history (see its module docstring). It is
hand-written and does not run Alembic. Twice already, an Alembic migration
added a column that `database_migrations.py` never learned about, so a local
SQLite database created before that migration existed 500'd on the first
request that touched the new column (see TODO_LIST.md section 9 and
`backend/tests/test_migration_failure_blocks_deploy.py` for the incident
this is meant to prevent).

This script statically scans every migration under `migrations/versions/`
for `add_column`, `create_table`, and rename operations, and checks that the
affected table/column name is at least mentioned in
`app/database_migrations.py`. It is a heuristic (a name match, not a
semantic diff) by design -- see the module docstring in
`legacy_migration_exemptions.py` for why not every new table needs a match,
and how to add an exemption when one genuinely doesn't.

Run directly:

    python scripts/check_migration_drift.py

Also wired into `tests/test_migration_drift.py` so it runs as part of the
normal backend test suite in CI.
"""

from __future__ import annotations

import ast
import sys
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from scripts.legacy_migration_exemptions import EXEMPT_COLUMNS, EXEMPT_TABLES

MIGRATIONS_DIR = BACKEND_ROOT / "migrations" / "versions"
LEGACY_MIGRATIONS_FILE = BACKEND_ROOT / "app" / "database_migrations.py"


@dataclass(frozen=True)
class SchemaChange:
    kind: str  # "add_column" | "create_table" | "rename_table" | "rename_column"
    table: str
    column: str | None
    migration_file: str


def _literal_str(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _column_name_from_column_call(node: ast.AST) -> str | None:
    if isinstance(node, ast.Call) and node.args:
        return _literal_str(node.args[0])
    return None


def _is_baseline_migration(tree: ast.Module) -> bool:
    """True for the initial-schema migration (down_revision is None).

    That migration is the ORM baseline: everything it creates is already
    handled by `Base.metadata.create_all()` for any database, so it is
    exempt from this check wholesale rather than needing every table listed
    in `legacy_migration_exemptions.py`.
    """

    for node in tree.body:
        target_names: list[str] = []
        value: ast.AST | None = None

        if isinstance(node, ast.Assign):
            target_names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            value = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            target_names = [node.target.id]
            value = node.value

        if "down_revision" in target_names and isinstance(value, ast.Constant):
            return value.value is None

    return False


class _MigrationVisitor(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.filename = filename
        self.changes: list[SchemaChange] = []
        self._batch_table_stack: list[str] = []

    def visit_With(self, node: ast.With) -> None:
        batch_table = None
        for item in node.items:
            call = item.context_expr
            if (
                isinstance(call, ast.Call)
                and isinstance(call.func, ast.Attribute)
                and call.func.attr == "batch_alter_table"
                and call.args
            ):
                batch_table = _literal_str(call.args[0])

        if batch_table:
            self._batch_table_stack.append(batch_table)
            self.generic_visit(node)
            self._batch_table_stack.pop()
        else:
            self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Attribute):
            attr = func.attr

            if attr == "create_table":
                table = _literal_str(node.args[0]) if node.args else None
                if table:
                    self.changes.append(
                        SchemaChange("create_table", table, None, self.filename)
                    )

            elif attr == "rename_table" and len(node.args) >= 2:
                new_name = _literal_str(node.args[1])
                if new_name:
                    self.changes.append(
                        SchemaChange("rename_table", new_name, None, self.filename)
                    )

            elif attr == "add_column":
                table = None
                column = None
                if self._batch_table_stack:
                    table = self._batch_table_stack[-1]
                    if node.args:
                        column = _column_name_from_column_call(node.args[0])
                elif len(node.args) >= 2:
                    table = _literal_str(node.args[0])
                    column = _column_name_from_column_call(node.args[1])
                if table and column:
                    self.changes.append(
                        SchemaChange("add_column", table, column, self.filename)
                    )

            elif attr == "alter_column":
                new_name = None
                for kw in node.keywords:
                    if kw.arg == "new_column_name":
                        new_name = _literal_str(kw.value)
                if new_name:
                    table = self._batch_table_stack[-1] if self._batch_table_stack else None
                    if table is None and node.args:
                        table = _literal_str(node.args[0])
                    if table:
                        self.changes.append(
                            SchemaChange("rename_column", table, new_name, self.filename)
                        )

        self.generic_visit(node)


def _extract_changes(path: Path) -> list[SchemaChange]:
    tree = ast.parse(path.read_text(), filename=str(path))

    if _is_baseline_migration(tree):
        return []

    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "upgrade":
            visitor = _MigrationVisitor(path.name)
            visitor.visit(node)
            return visitor.changes

    return []


def collect_all_changes() -> list[SchemaChange]:
    changes: list[SchemaChange] = []
    for path in sorted(MIGRATIONS_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        changes.extend(_extract_changes(path))
    return changes


def find_migration_drift() -> list[str]:
    """Return human-readable drift descriptions; empty means no drift."""

    legacy_source = LEGACY_MIGRATIONS_FILE.read_text()
    problems: list[str] = []

    for change in collect_all_changes():
        if change.kind in {"create_table", "rename_table"}:
            if change.table in EXEMPT_TABLES:
                continue
            if change.table not in legacy_source:
                problems.append(
                    f"{change.migration_file}: {change.kind} '{change.table}' "
                    "has no matching reference in app/database_migrations.py. "
                    "Add the equivalent legacy SQLite migration for existing "
                    "local databases, or add the table to EXEMPT_TABLES in "
                    "scripts/legacy_migration_exemptions.py with a reason."
                )

        elif change.kind in {"add_column", "rename_column"}:
            key = (change.table, change.column)
            if key in EXEMPT_COLUMNS:
                continue
            if change.table not in legacy_source or change.column not in legacy_source:
                problems.append(
                    f"{change.migration_file}: {change.kind} '{change.column}' "
                    f"on table '{change.table}' has no matching reference in "
                    "app/database_migrations.py. Add the equivalent legacy "
                    "SQLite ALTER TABLE for existing local databases, or add "
                    f"('{change.table}', '{change.column}') to EXEMPT_COLUMNS "
                    "in scripts/legacy_migration_exemptions.py with a reason."
                )

    return problems


def main() -> int:
    problems = find_migration_drift()

    if not problems:
        print("No Alembic/legacy-SQLite migration drift detected.")
        return 0

    print("Alembic/legacy-SQLite migration drift detected:\n")
    for problem in problems:
        print(f"  - {problem}")
    print(
        "\nSee the module docstring in scripts/check_migration_drift.py and "
        "scripts/legacy_migration_exemptions.py for how to resolve this."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
