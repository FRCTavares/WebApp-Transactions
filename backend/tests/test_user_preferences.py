def test_preferences_have_defaults_and_are_persisted(client):
    response = client.get("/api/preferences")
    assert response.status_code == 200
    assert response.json() == {
        "locale": "en-GB",
        "currency": "EUR",
        "time_zone": "Europe/Lisbon",
        "date_format": "medium",
        "language": "en",
    }

    updated = client.put(
        "/api/preferences",
        json={
            "locale": "pt-PT",
            "currency": "usd",
            "time_zone": "Atlantic/Azores",
            "date_format": "long",
            "language": "pt",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["currency"] == "USD"
    assert client.get("/api/preferences").json() == updated.json()


def test_preferences_reject_invalid_values(client):
    payload = {
        "locale": "invalid",
        "currency": "EUR",
        "time_zone": "Europe/Lisbon",
        "date_format": "medium",
        "language": "en",
    }
    assert client.put("/api/preferences", json=payload).status_code == 422
