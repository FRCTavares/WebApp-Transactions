from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.description_rule_repository import DescriptionRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.description_rule import (
    DescriptionRuleCreate,
    DescriptionRuleRead,
    DescriptionRuleSuggestion,
    DescriptionRuleUpdate,
)
from app.services.description_rule_service import DescriptionRuleService


router = APIRouter(prefix="/api/description-rules", tags=["description-rules"])


def get_description_rule_service(
    db: Session = Depends(get_db),
) -> DescriptionRuleService:
    description_rule_repository = DescriptionRuleRepository(db)
    transaction_repository = TransactionRepository(db)

    return DescriptionRuleService(
        description_rule_repository=description_rule_repository,
        transaction_repository=transaction_repository,
    )


@router.post("", response_model=DescriptionRuleRead, status_code=status.HTTP_201_CREATED)
def create_description_rule(
    rule_data: DescriptionRuleCreate,
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_rule(rule_data, current_user=current_user)


@router.get("", response_model=list[DescriptionRuleRead])
def list_description_rules(
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_rules(
        active_only=active_only,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.post("/apply")
def apply_description_rules(
    limit: int = Query(default=1000, ge=1, le=5000),
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.apply_rules_to_existing_transactions(
        limit=limit,
        current_user=current_user,
    )


@router.get("/suggestions", response_model=list[DescriptionRuleSuggestion])
def list_description_rule_suggestions(
    direction: str | None = Query(default=None, pattern="^(in|out)$"),
    limit: int = Query(default=50, ge=1, le=200),
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_rule_suggestions(
        direction=direction,
        limit=limit,
        current_user=current_user,
    )


@router.get("/{rule_id}", response_model=DescriptionRuleRead)
def get_description_rule(
    rule_id: int,
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_rule(rule_id, current_user=current_user)


@router.patch("/{rule_id}", response_model=DescriptionRuleRead)
def update_description_rule(
    rule_id: int,
    rule_data: DescriptionRuleUpdate,
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_rule(rule_id, rule_data, current_user=current_user)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_description_rule(
    rule_id: int,
    service: DescriptionRuleService = Depends(get_description_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_rule(rule_id, current_user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
