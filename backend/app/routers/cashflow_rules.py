from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.cashflow_rule_repository import CashflowRuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.cashflow_rule import (
    CashflowRuleCreate,
    CashflowRuleRead,
    CashflowRuleUpdate,
)
from app.services.cashflow_rule_service import CashflowRuleService


router = APIRouter(prefix="/api/cashflow-rules", tags=["cashflow-rules"])


def get_cashflow_rule_service(
    db: Session = Depends(get_db),
) -> CashflowRuleService:
    cashflow_rule_repository = CashflowRuleRepository(db)
    transaction_repository = TransactionRepository(db)

    return CashflowRuleService(
        cashflow_rule_repository=cashflow_rule_repository,
        transaction_repository=transaction_repository,
    )


@router.post("", response_model=CashflowRuleRead, status_code=status.HTTP_201_CREATED)
def create_cashflow_rule(
    rule_data: CashflowRuleCreate,
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.create_rule(rule_data, current_user)


@router.get("", response_model=list[CashflowRuleRead])
def list_cashflow_rules(
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.list_rules(
        active_only=active_only,
        limit=limit,
        offset=offset,
        current_user=current_user,
    )


@router.post("/apply")
def apply_cashflow_rules(
    limit: int = Query(default=1000, ge=1, le=5000),
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.apply_rules_to_existing_transactions(
        limit=limit,
        current_user=current_user,
    )


@router.get("/{rule_id}", response_model=CashflowRuleRead)
def get_cashflow_rule(
    rule_id: int,
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_rule(rule_id, current_user)


@router.patch("/{rule_id}", response_model=CashflowRuleRead)
def update_cashflow_rule(
    rule_id: int,
    rule_data: CashflowRuleUpdate,
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_rule(rule_id, rule_data, current_user)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cashflow_rule(
    rule_id: int,
    service: CashflowRuleService = Depends(get_cashflow_rule_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    service.delete_rule(rule_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
