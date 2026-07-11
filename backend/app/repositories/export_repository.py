from sqlalchemy import select
from sqlalchemy.orm import Session

from app.recovery_registry import (
    USER_RECOVERY_MODEL_BY_TABLE,
    USER_RECOVERY_TABLE_NAMES,
)


class ExportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(
        self,
        model: type[object],
        user_id: str,
    ) -> list[object]:
        statement = (
            select(model)
            .where(model.user_id == user_id)
            .order_by(model.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def export_user_data(self, user_id: str) -> dict[str, list[object]]:
        return {
            table_name: self.list_for_user(
                USER_RECOVERY_MODEL_BY_TABLE[table_name],
                user_id,
            )
            for table_name in USER_RECOVERY_TABLE_NAMES
        }
