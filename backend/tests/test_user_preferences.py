def test_preferences_have_defaults_and_are_persisted(client):
    response = client.get("/api/preferences")
    assert response.status_code == 200
    assert response.json() == {
        "locale": "en-GB",
        "currency": "EUR",
        "time_zone": "Europe/Lisbon",
        "date_format": "medium",
        "language": "en",
        "monthly_investment_goal_eur": "100.00",
    }

    updated = client.put(
        "/api/preferences",
        json={
            "locale": "pt-PT",
            "currency": "usd",
            "time_zone": "Atlantic/Azores",
            "date_format": "long",
            "language": "pt",
            "monthly_investment_goal_eur": "250.00",
        },
    )

    assert updated.status_code == 200
    assert updated.json()["currency"] == "USD"
    assert updated.json()["monthly_investment_goal_eur"] == "250.00"
    assert client.get("/api/preferences").json() == updated.json()


def test_preferences_reject_invalid_values(client):
    payload = {
        "locale": "invalid",
        "currency": "EUR",
        "time_zone": "Europe/Lisbon",
        "date_format": "medium",
        "language": "en",
        "monthly_investment_goal_eur": "100.00",
    }

    assert client.put("/api/preferences", json=payload).status_code == 422


def test_preferences_reject_non_positive_investment_goal(client):
    payload = {
        "locale": "en-GB",
        "currency": "EUR",
        "time_zone": "Europe/Lisbon",
        "date_format": "medium",
        "language": "en",
        "monthly_investment_goal_eur": "0.00",
    }

    assert client.put("/api/preferences", json=payload).status_code == 422


def test_preferences_update_preserves_goal_when_omitted(client):
    first_update = client.put(
        "/api/preferences",
        json={
            "locale": "en-GB",
            "currency": "EUR",
            "time_zone": "Europe/Lisbon",
            "date_format": "medium",
            "language": "en",
            "monthly_investment_goal_eur": "275.00",
        },
    )

    assert first_update.status_code == 200

    second_update = client.put(
        "/api/preferences",
        json={
            "locale": "pt-PT",
            "currency": "EUR",
            "time_zone": "Europe/Lisbon",
            "date_format": "long",
            "language": "pt",
        },
    )

    assert second_update.status_code == 200
    assert (
        second_update.json()["monthly_investment_goal_eur"]
        == "275.00"
    )
