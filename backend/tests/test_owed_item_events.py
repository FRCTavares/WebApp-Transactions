from datetime import UTC, date, datetime
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.owed_item import OwedItem
from app.models.owed_item_event import OwedItemEvent


def get_item_events(db_session, owed_item_id: int) -> list[OwedItemEvent]:
    return (
        db_session.query(OwedItemEvent)
        .filter(OwedItemEvent.user_id == LOCAL_DEFAULT_USER_ID)
        .filter(OwedItemEvent.owed_item_id == owed_item_id)
        .order_by(
            OwedItemEvent.effective_date.asc(),
            OwedItemEvent.id.asc(),
        )
        .all()
    )


def create_owed_item(
    client,
    *,
    person: str = "Mother",
    amount_total: str = "30.00",
    due_date: str | None = None,
):
    response = client.post(
        "/api/owed",
        json={
            "person": person,
            "reason": "Shared expense",
            "amount_total": amount_total,
            "amount_paid": "0.00",
            "due_date": due_date,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_owed_item_records_created_event(client, db_session):
    item = create_owed_item(client)

    events = get_item_events(db_session, item["id"])

    assert len(events) == 1
    assert events[0].event_type == "created"
    assert events[0].effective_date == datetime.now(UTC).date()
    assert events[0].amount_total == Decimal("30.00")
    assert events[0].amount_paid == Decimal("0.00")
    assert events[0].amount_remaining == Decimal("30.00")
    assert events[0].status == "open"


def test_update_owed_item_records_adjusted_event(client, db_session):
    item = create_owed_item(client)

    response = client.patch(
        f"/api/owed/{item['id']}",
        json={"amount_paid": "10.00"},
    )

    assert response.status_code == 200

    events = get_item_events(db_session, item["id"])

    assert [event.event_type for event in events] == [
        "created",
        "adjusted",
    ]
    assert events[-1].amount_paid == Decimal("10.00")
    assert events[-1].amount_remaining == Decimal("20.00")
    assert events[-1].status == "partially_paid"


def test_cancel_and_reopen_record_status_events(client, db_session):
    item = create_owed_item(client)

    cancel_response = client.patch(
        f"/api/owed/{item['id']}",
        json={"status": "cancelled"},
    )
    assert cancel_response.status_code == 200

    reopen_response = client.patch(
        f"/api/owed/{item['id']}",
        json={"status": "open"},
    )
    assert reopen_response.status_code == 200

    events = get_item_events(db_session, item["id"])

    assert [event.event_type for event in events] == [
        "created",
        "cancelled",
        "reopened",
    ]


def test_payment_records_payment_event_on_payment_date(client, db_session):
    item = create_owed_item(
        client,
        amount_total="30.00",
        due_date="2026-06-01",
    )

    response = client.post(
        "/api/owed/payments",
        json={
            "person": "Mother",
            "payment_date": "2026-06-14",
            "amount": "12.00",
            "method": "bank_transfer",
            "allocations": [
                {
                    "owed_item_id": item["id"],
                    "amount": "12.00",
                }
            ],
        },
    )

    assert response.status_code == 201
    payment = response.json()

    events = get_item_events(db_session, item["id"])
    payment_event = events[-1]

    assert payment_event.event_type == "payment"
    assert payment_event.effective_date == date(2026, 6, 14)
    assert payment_event.owed_payment_id == payment["id"]
    assert payment_event.amount_paid == Decimal("12.00")
    assert payment_event.amount_remaining == Decimal("18.00")


def test_delete_payment_records_reversal_event(client, db_session):
    item = create_owed_item(
        client,
        amount_total="30.00",
        due_date="2026-06-01",
    )

    payment_response = client.post(
        "/api/owed/payments",
        json={
            "person": "Mother",
            "payment_date": "2026-06-14",
            "amount": "12.00",
            "method": "bank_transfer",
            "allocations": [
                {
                    "owed_item_id": item["id"],
                    "amount": "12.00",
                }
            ],
        },
    )
    assert payment_response.status_code == 201

    payment_id = payment_response.json()["id"]
    delete_response = client.delete(f"/api/owed/payments/{payment_id}")

    assert delete_response.status_code == 204

    db_session.expire_all()
    events = get_item_events(db_session, item["id"])

    assert [event.event_type for event in events] == [
        "created",
        "payment",
        "payment_reversed",
    ]
    assert events[-1].effective_date == datetime.now(UTC).date()
    assert events[-1].owed_payment_id == payment_id
    assert events[-1].amount_paid == Decimal("0.00")
    assert events[-1].amount_remaining == Decimal("30.00")
    assert events[-1].status == "open"


def test_delete_owed_item_soft_deletes_and_records_event(
    client,
    db_session,
):
    item = create_owed_item(client)

    response = client.delete(f"/api/owed/{item['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/owed/{item['id']}").status_code == 404

    db_session.expire_all()
    stored_item = db_session.get(OwedItem, item["id"])
    events = get_item_events(db_session, item["id"])

    assert stored_item is not None
    assert stored_item.deleted_at is not None
    assert [event.event_type for event in events] == [
        "created",
        "deleted",
    ]
    assert events[-1].effective_date == datetime.now(UTC).date()
