from fastapi import APIRouter, Depends

from app.auth.current_user import CurrentUser, get_current_user


router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/me")
def read_current_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str | None]:
    return {
        "user_id": current_user.id,
        "email": current_user.email,
    }
