from dataclasses import dataclass


LOCAL_DEFAULT_USER_ID = "local-default-user"


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user context used by services and repositories.

    During local-first development, this is always the same fixed local user.
    Later, real authentication should replace get_current_user while preserving
    the CurrentUser shape used by routers and services.
    """

    id: str


def get_local_default_user() -> CurrentUser:
    return CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def get_current_user() -> CurrentUser:
    """Return the current user for FastAPI dependency injection.

    This is not real authentication. It is the Phase 8 bridge that lets the
    backend start passing user context before adding OAuth, Supabase Auth, or
    public deployment.
    """

    return get_local_default_user()
