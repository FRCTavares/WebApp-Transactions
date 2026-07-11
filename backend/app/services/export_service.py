from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.inspection import inspect

from app.auth.current_user import CurrentUser
from app.recovery_registry import EXPORT_FORMAT_VERSION
from app.repositories.export_repository import ExportRepository


def to_json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, datetime | date):
        return value.isoformat()

    return value


def model_to_dict(model: object) -> dict[str, Any]:
    mapper = inspect(model.__class__)
    return {
        column.key: to_json_safe(getattr(model, column.key))
        for column in mapper.columns
    }


class ExportService:
    def __init__(self, repository: ExportRepository) -> None:
        self.repository = repository

    def export_current_user(self, current_user: CurrentUser) -> dict[str, Any]:
        exported_data = self.repository.export_user_data(current_user.id)

        return {
            "format_version": EXPORT_FORMAT_VERSION,
            "user_id": current_user.id,
            "email": current_user.email,
            "tables": {
                table_name: [model_to_dict(row) for row in rows]
                for table_name, rows in exported_data.items()
            },
        }
