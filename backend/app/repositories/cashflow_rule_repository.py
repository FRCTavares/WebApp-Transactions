from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cashflow_rule import CashflowRule
from app.schemas.cashflow_rule import CashflowRuleCreate, CashflowRuleUpdate


class CashflowRuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        rule_data: CashflowRuleCreate,
        user_id: str,
    ) -> CashflowRule:
        rule = CashflowRule(
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
    ) -> list[CashflowRule]:
        statement = (
            select(CashflowRule)
            .where(CashflowRule.user_id == user_id)
            .order_by(CashflowRule.id.asc())
        )

        if active_only:
            statement = statement.where(CashflowRule.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_all(self, user_id: str) -> list[CashflowRule]:
        statement = (
            select(CashflowRule)
            .where(CashflowRule.user_id == user_id)
            .order_by(CashflowRule.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id(
        self,
        rule_id: int,
        user_id: str,
    ) -> CashflowRule | None:
        statement = (
            select(CashflowRule)
            .where(CashflowRule.id == rule_id)
            .where(CashflowRule.user_id == user_id)
            .limit(1)
        )
        return self.db.scalar(statement)

    def update(
        self,
        rule: CashflowRule,
        rule_data: CashflowRuleUpdate,
    ) -> CashflowRule:
        update_data = rule_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(rule, field, value)

        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, rule: CashflowRule) -> None:
        self.db.delete(rule)
        self.db.commit()
