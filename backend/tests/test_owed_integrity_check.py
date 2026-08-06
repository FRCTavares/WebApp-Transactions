from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID, get_privileged_user
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent


ADMIN_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID, email="admin@example.com")


def use_privileged_user(client) -> None:
    client.app.dependency_overrides[get_privileged_user] = lambda: ADMIN_USER


def test_integrity_check_requires_privileged_access(client):
    response = client.get("/api/owed/integrity-check")

    assert response.status_code == 403


def test_integrity_check_finds_nothing_wrong_for_clean_data(client, db_session):
    use_privileged_user(client)

    item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Mother",
        amount_total=Decimal("100.00"),
        amount_paid=Decimal("40.00"),
        amount_remaining=Decimal("60.00"),
        reason="Shared costs",
        status="partially_paid",
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        OwedItemEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            owed_item_id=item.id,
            event_type="payment",
            effective_date=date(2026, 1, 10),
            amount_total=Decimal("100.00"),
            amount_paid=Decimal("40.00"),
            amount_remaining=Decimal("60.00"),
            status="partially_paid",
            notes="In sync.",
        )
    )
    db_session.commit()

    response = client.get("/api/owed/integrity-check")

    assert response.status_code == 200
    assert response.json() == []


def test_integrity_check_finds_item_with_no_event(client, db_session):
    use_privileged_user(client)

    item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Legacy Import",
        amount_total=Decimal("50.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("50.00"),
        reason="Imported with no event",
        status="open",
    )
    db_session.add(item)
    db_session.commit()

    response = client.get("/api/owed/integrity-check")

    assert response.status_code == 200
    issues = response.json()
    assert len(issues) == 1
    assert issues[0]["owed_item_id"] == item.id
    assert issues[0]["latest_event_amount_remaining"] is None
    assert "No event on record" in issues[0]["reason"]


def test_integrity_check_finds_stale_event(client, db_session):
    use_privileged_user(client)

    item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Legacy Import",
        amount_total=Decimal("500.00"),
        amount_paid=Decimal("500.00"),
        amount_remaining=Decimal("0.00"),
        reason="Paid off outside the normal update flow",
        status="paid",
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        OwedItemEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            owed_item_id=item.id,
            event_type="created",
            effective_date=date(2026, 1, 10),
            amount_total=Decimal("500.00"),
            amount_paid=Decimal("0.00"),
            amount_remaining=Decimal("500.00"),
            status="open",
            notes="Stale.",
        )
    )
    db_session.commit()

    response = client.get("/api/owed/integrity-check")

    assert response.status_code == 200
    issues = response.json()
    assert len(issues) == 1
    assert issues[0]["owed_item_id"] == item.id
    assert issues[0]["item_amount_remaining"] == "0.00"
    assert issues[0]["latest_event_amount_remaining"] == "500.00"
    assert issues[0]["latest_event_status"] == "open"


def test_integrity_check_flags_active_item_whose_latest_event_is_deleted(
    client,
    db_session,
):
    use_privileged_user(client)

    item = OwedItem(
        user_id=LOCAL_DEFAULT_USER_ID,
        person="Legacy Import",
        amount_total=Decimal("30.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("30.00"),
        reason="Reinstated after being deleted, without a new event",
        status="open",
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        OwedItemEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            owed_item_id=item.id,
            event_type="deleted",
            effective_date=date(2026, 1, 10),
            amount_total=Decimal("30.00"),
            amount_paid=Decimal("0.00"),
            amount_remaining=Decimal("30.00"),
            status="open",
            notes="Deleted, then the item row was reinstated directly.",
        )
    )
    db_session.commit()

    response = client.get("/api/owed/integrity-check")

    assert response.status_code == 200
    issues = response.json()
    assert len(issues) == 1
    assert issues[0]["owed_item_id"] == item.id
    assert issues[0]["latest_event_type"] == "deleted"
