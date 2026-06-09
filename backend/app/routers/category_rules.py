from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.category_rule_repository import CategoryRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.category_rule import (
    CategoryRuleCreate,
    CategoryRuleRead,
    CategoryRuleSuggestion,
    CategoryRuleUpdate,
)
from app.services.category_rule_service import CategoryRuleService


router = APIRouter(prefix="/api/category-rules", tags=["category-rules"])


def get_category_rule_service(
    db: Session = Depends(get_db),
) -> CategoryRuleService:
    category_rule_repository = CategoryRuleRepository(db)
    transaction_repository = TransactionRepository(db)

    return CategoryRuleService(
        category_rule_repository=category_rule_repository,
        transaction_repository=transaction_repository,
    )


@router.post("", response_model=CategoryRuleRead, status_code=status.HTTP_201_CREATED)
def create_category_rule(
    rule_data: CategoryRuleCreate,
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.create_rule(rule_data)


@router.get("", response_model=list[CategoryRuleRead])
def list_category_rules(
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.list_rules(
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.post("/apply")
def apply_category_rules(
    limit: int = Query(default=1000, ge=1, le=5000),
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.apply_rules_to_existing_transactions(limit=limit)


@router.get("/suggestions", response_model=list[CategoryRuleSuggestion])
def list_category_rule_suggestions(
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    limit: int = Query(default=20, ge=1, le=100),
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.get_rule_suggestions(
        direction=direction,
        limit=limit,
    )


@router.get("/{rule_id}", response_model=CategoryRuleRead)
def get_category_rule(
    rule_id: int,
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.get_rule(rule_id)


@router.patch("/{rule_id}", response_model=CategoryRuleRead)
def update_category_rule(
    rule_id: int,
    rule_data: CategoryRuleUpdate,
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    return service.update_rule(rule_id, rule_data)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category_rule(
    rule_id: int,
    service: CategoryRuleService = Depends(get_category_rule_service),
):
    service.delete_rule(rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
