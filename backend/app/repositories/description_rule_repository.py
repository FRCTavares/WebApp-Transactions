from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.description_rule import DescriptionRule
from app.schemas.description_rule import DescriptionRuleCreate, DescriptionRuleUpdate


class DescriptionRuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, rule_data: DescriptionRuleCreate) -> DescriptionRule:
        rule = DescriptionRule(**rule_data.model_dump())
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DescriptionRule]:
        statement = select(DescriptionRule).order_by(DescriptionRule.id.asc())

        if active_only:
            statement = statement.where(DescriptionRule.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def list_all(self) -> list[DescriptionRule]:
        statement = select(DescriptionRule).order_by(DescriptionRule.id.asc())
        return list(self.db.scalars(statement).all())

    def get_by_id(self, rule_id: int) -> DescriptionRule | None:
        return self.db.get(DescriptionRule, rule_id)

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
