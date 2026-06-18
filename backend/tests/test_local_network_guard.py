from app.auth.local_network import (
    is_local_network_client,
    is_local_network_only_enabled,
)


def test_local_network_only_env_truthy_values(monkeypatch):
    for value in ["true", "TRUE", "1", "yes", "on"]:
        monkeypatch.setenv("LOCAL_NETWORK_ONLY", value)

        assert is_local_network_only_enabled() is True


def test_local_network_only_env_disabled_by_default(monkeypatch):
    monkeypatch.delenv("LOCAL_NETWORK_ONLY", raising=False)

    assert is_local_network_only_enabled() is False


def test_local_network_only_env_false_values(monkeypatch):
    for value in ["false", "0", "no", "off", ""]:
        monkeypatch.setenv("LOCAL_NETWORK_ONLY", value)

        assert is_local_network_only_enabled() is False


def test_local_network_client_accepts_loopback_private_and_link_local_ips():
    allowed_hosts = [
        "127.0.0.1",
        "::1",
        "192.168.1.50",
        "172.20.10.3",
        "10.0.0.5",
        "169.254.10.20",
    ]

    for host in allowed_hosts:
        assert is_local_network_client(host) is True


def test_local_network_client_rejects_public_invalid_and_missing_hosts():
    rejected_hosts = [
        "8.8.8.8",
        "1.1.1.1",
        "example.com",
        "",
        None,
    ]

    for host in rejected_hosts:
        assert is_local_network_client(host) is False
