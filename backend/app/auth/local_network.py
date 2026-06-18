import ipaddress
import os


TRUE_ENV_VALUES = {"1", "true", "yes", "on"}


def is_local_network_only_enabled() -> bool:
    return os.getenv("LOCAL_NETWORK_ONLY", "").strip().lower() in TRUE_ENV_VALUES


def is_local_network_client(host: str | None) -> bool:
    if not host:
        return False

    try:
        ip_address = ipaddress.ip_address(host.strip())
    except ValueError:
        return False

    return (
        ip_address.is_loopback
        or ip_address.is_private
        or ip_address.is_link_local
    )
