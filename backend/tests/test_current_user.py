from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.current_user import (
    LOCAL_DEFAULT_USER_ID,
    CurrentUser,
    get_current_user,
    get_local_default_user,
)


def test_local_default_user_has_stable_id():
    user = get_local_default_user()

    assert user == CurrentUser(id=LOCAL_DEFAULT_USER_ID)
    assert user.id == "local-default-user"


def test_current_user_dependency_returns_local_default_user():
    app = FastAPI()

    @app.get("/whoami")
    def whoami(current_user: CurrentUser = Depends(get_current_user)):
        return {"user_id": current_user.id}

    with TestClient(app) as client:
        response = client.get("/whoami")

    assert response.status_code == 200
    assert response.json() == {"user_id": LOCAL_DEFAULT_USER_ID}
