from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.description_rule import DescriptionRule
from app.schemas.description_rule import DescriptionRuleCreate, DescriptionRuleUpdate


class DescriptionRuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        rule_data: DescriptionRuleCreate,
        user_id: str,
    ) -> DescriptionRule:
        rule = DescriptionRule(
            **rule_data.model_dump(),
            user_id=user_id,
        )
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list(
        self,
        user_id: str,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DescriptionRule]:
        statement = (
            select(DescriptionRule)
            .where(DescriptionRule.user_id == user_id)
            .order_by(DescriptionRule.id.asc())
        )

        if active_only:
            statement = statement.where(DescriptionRule.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_all(self, user_id: str) -> list[DescriptionRule]:
        statement = (
            select(DescriptionRule)
            .where(DescriptionRule.user_id == user_id)
            .order_by(DescriptionRule.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id(
        self,
        rule_id: int,
        user_id: str,
    ) -> DescriptionRule | None:
        statement = (
            select(DescriptionRule)
            .where(DescriptionRule.id == rule_id)
            .where(DescriptionRule.user_id == user_id)
            .limit(1)
        )
        return self.db.scalar(statement)

    def update(
        self,
        rule: DescriptionRule,
        rule_data: DescriptionRuleUpdate,
    ) -> DescriptionRule:
        update_data = rule_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(rule, field, value)

        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, rule: DescriptionRule) -> None:
        self.db.delete(rule)
        self.db.commit()
