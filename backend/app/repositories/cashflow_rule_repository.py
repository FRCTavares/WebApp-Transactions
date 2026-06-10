from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cashflow_rule import CashflowRule
from app.schemas.cashflow_rule import CashflowRuleCreate, CashflowRuleUpdate


class CashflowRuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, rule_data: CashflowRuleCreate) -> CashflowRule:
        rule = CashflowRule(**rule_data.model_dump())
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CashflowRule]:
        statement = select(CashflowRule).order_by(CashflowRule.id.asc())

        if active_only:
            statement = statement.where(CashflowRule.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_all(self) -> list[CashflowRule]:
        statement = select(CashflowRule).order_by(CashflowRule.id.asc())
        return list(self.db.scalars(statement).all())

    def get_by_id(self, rule_id: int) -> CashflowRule | None:
        return self.db.get(CashflowRule, rule_id)

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
