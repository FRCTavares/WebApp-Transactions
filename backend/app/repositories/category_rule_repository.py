from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category_rule import CategoryRule
from app.schemas.category_rule import CategoryRuleCreate, CategoryRuleUpdate


class CategoryRuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, rule_data: CategoryRuleCreate) -> CategoryRule:
        rule = CategoryRule(**rule_data.model_dump())
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list(
        self,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CategoryRule]:
        statement = select(CategoryRule).order_by(CategoryRule.id.asc())

        if active_only:
            statement = statement.where(CategoryRule.is_active.is_(True))

        statement = statement.offset(offset).limit(limit)

        return list(self.db.scalars(statement).all())

    def get_by_id(self, rule_id: int) -> CategoryRule | None:
        return self.db.get(CategoryRule, rule_id)

    def update(
        self,
        rule: CategoryRule,
        rule_data: CategoryRuleUpdate,
    ) -> CategoryRule:
        update_data = rule_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(rule, field, value)

        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, rule: CategoryRule) -> None:
        self.db.delete(rule)
        self.db.commit()
