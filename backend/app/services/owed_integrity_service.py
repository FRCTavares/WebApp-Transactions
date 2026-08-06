"""Owed-item event-log integrity diagnostics and repair.

Split out of `owed_service.py` (which was approaching the project's
900-line preferred ceiling) to keep the day-to-day create/update/payment
logic separate from this diagnostic-only concern. This is a mixin
consumed by `OwedService`, not a standalone service - it relies on
`self.repository` and `self._build_event` being set/defined by that
class.

Background: WealthService.get_monthly_totals() used to reconstruct
"how much is owed to me right now" by replaying owed_item_events history
instead of reading OwedItem.amount_remaining directly. That surfaced a
real data drift - several legacy-imported items were fully paid off
without a matching event ever being recorded - which made the Wealth
trend chart's current-month point disagree with the summary card above
it. These methods find (and, deliberately narrowly, fix) that drift.
"""

from app.auth.current_user import CurrentUser
from app.models.owed_item_event import OwedItemEvent
from app.schemas.owed_item import OwedItemIntegrityIssue


class OwedIntegrityMixin:
    def find_integrity_issues(
        self,
        *,
        current_user: CurrentUser,
    ) -> list[OwedItemIntegrityIssue]:
        """Compare every non-deleted OwedItem against its own latest event.

        Diagnostic only - does not correct anything, so it is safe to
        call repeatedly while the actual bad row(s) are tracked down.
        """
        user_id = current_user.id
        items = self.repository.list(
            user_id=user_id,
            limit=10000,
            offset=0,
        )
        events = self.repository.list_all_events_ascending(user_id)

        latest_event_by_item: dict[int, OwedItemEvent] = {}
        for event in events:
            latest_event_by_item[event.owed_item_id] = event

        issues: list[OwedItemIntegrityIssue] = []

        for item in items:
            latest_event = latest_event_by_item.get(item.id)

            if latest_event is None:
                issues.append(
                    OwedItemIntegrityIssue(
                        owed_item_id=item.id,
                        person=item.person,
                        reason="No event on record for this item at all.",
                        item_amount_remaining=item.amount_remaining,
                        item_status=item.status,
                        latest_event_amount_remaining=None,
                        latest_event_status=None,
                        latest_event_type=None,
                    )
                )
                continue

            if latest_event.event_type == "deleted":
                issues.append(
                    OwedItemIntegrityIssue(
                        owed_item_id=item.id,
                        person=item.person,
                        reason=(
                            "Item exists and is not deleted, but its "
                            "latest event is a delete event."
                        ),
                        item_amount_remaining=item.amount_remaining,
                        item_status=item.status,
                        latest_event_amount_remaining=(
                            latest_event.amount_remaining
                        ),
                        latest_event_status=latest_event.status,
                        latest_event_type=latest_event.event_type,
                    )
                )
                continue

            if (
                latest_event.amount_remaining != item.amount_remaining
                or latest_event.status != item.status
            ):
                issues.append(
                    OwedItemIntegrityIssue(
                        owed_item_id=item.id,
                        person=item.person,
                        reason=(
                            "Latest event does not match the item's "
                            "current amount_remaining/status."
                        ),
                        item_amount_remaining=item.amount_remaining,
                        item_status=item.status,
                        latest_event_amount_remaining=(
                            latest_event.amount_remaining
                        ),
                        latest_event_status=latest_event.status,
                        latest_event_type=latest_event.event_type,
                    )
                )

        return issues

    def backfill_stale_owed_events(
        self,
        *,
        current_user: CurrentUser,
    ) -> list[OwedItemIntegrityIssue]:
        """Create a corrective 'payment' event for every OwedItem whose
        latest event disagrees with the item's own current state (see
        find_integrity_issues). Deliberately does not touch items with no
        event at all, or an active item whose latest event is a delete -
        both need a human judgment call this method should not make on
        its own.

        Returns the issues that were actually repaired.
        """
        user_id = current_user.id
        items = self.repository.list(
            user_id=user_id,
            limit=10000,
            offset=0,
        )
        events = self.repository.list_all_events_ascending(user_id)

        latest_event_by_item: dict[int, OwedItemEvent] = {}
        for event in events:
            latest_event_by_item[event.owed_item_id] = event

        repaired: list[OwedItemIntegrityIssue] = []

        try:
            for item in items:
                latest_event = latest_event_by_item.get(item.id)

                if latest_event is None or latest_event.event_type == "deleted":
                    continue

                if (
                    latest_event.amount_remaining == item.amount_remaining
                    and latest_event.status == item.status
                ):
                    continue

                repaired.append(
                    OwedItemIntegrityIssue(
                        owed_item_id=item.id,
                        person=item.person,
                        reason=(
                            "Backfilled a payment event matching the "
                            "item's current state."
                        ),
                        item_amount_remaining=item.amount_remaining,
                        item_status=item.status,
                        latest_event_amount_remaining=(
                            latest_event.amount_remaining
                        ),
                        latest_event_status=latest_event.status,
                        latest_event_type=latest_event.event_type,
                    )
                )
                self.repository.create_event(
                    self._build_event(
                        owed_item=item,
                        event_type="payment",
                        # max(...) guarantees this event sorts after the
                        # stale one regardless of what item.updated_at
                        # actually is - list_all_events_ascending() orders
                        # by (effective_date, id), so a backfilled event
                        # dated *before* the stale event it's meant to
                        # replace would never become "latest" and the
                        # drift would look fixed here but persist on the
                        # next check.
                        effective_date=max(
                            item.updated_at.date(),
                            latest_event.effective_date,
                        ),
                        notes=(
                            "Backfilled: the item was already paid/edited "
                            "but no matching event existed on record "
                            "(found via the integrity check). Dated to "
                            "the item's last-updated timestamp (or the "
                            "prior event's date if later), per "
                            "Francisco's confirmation."
                        ),
                    )
                )

            self.repository.commit()
        except Exception:
            self.repository.rollback()
            raise

        return repaired
