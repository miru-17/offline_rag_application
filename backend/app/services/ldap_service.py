"""
Active Directory / LDAP sign-in.

The user's password is checked by binding to the directory as that user;
RAGENTIS never stores it. Group membership (memberOf) is mapped to a role.
Usernames are escaped before use in search filters (no LDAP injection).

LDAP_SERVER_URL "mock://<fixture.json>" is a TESTING-ONLY in-memory directory.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.core import config
from app.core.logging import get_logger

logger = get_logger("ldap")

_USERNAME = re.compile(r"^[A-Za-z0-9_.@-]{1,100}$")


@dataclass
class DirectoryUser:
    username: str
    email: str
    role: str


class LdapUnavailable(Exception):
    pass


def enabled() -> bool:
    return config.LDAP_ENABLED and bool(config.LDAP_SERVER_URL)


def _role_map() -> list[tuple[str, str]]:
    pairs = []
    for item in config.LDAP_GROUP_ROLE_MAP.split(";"):
        if "=" not in item.strip():
            continue
        group, role = item.strip().rsplit("=", 1)
        if role.strip().upper() in {"ADMIN", "USER", "VIEWER"}:
            pairs.append((group.strip().lower(), role.strip().upper()))
    return pairs


def _role_for(groups: list[str]) -> str:
    lowered = {g.lower() for g in groups}
    mapping = _role_map()
    for wanted in ("ADMIN", "USER", "VIEWER"):
        if any(group in lowered for group, role in mapping if role == wanted):
            return wanted
    return config.LDAP_DEFAULT_ROLE.upper() if config.LDAP_DEFAULT_ROLE.upper() in {"ADMIN", "USER", "VIEWER"} else "VIEWER"


def _mock_authenticate(username: str, password: str) -> DirectoryUser | None:
    fixture = config.LDAP_SERVER_URL[len("mock://"):]
    with open(fixture, encoding="utf-8") as handle:
        users = json.load(handle)
    entry = users.get(username)
    if not entry or entry.get("password") != password:
        return None
    return DirectoryUser(username, entry.get("mail") or f"{username}@directory.local", _role_for(entry.get("memberOf", [])))


def authenticate(username: str, password: str) -> DirectoryUser | None:
    """Return the directory user, None for wrong credentials; LdapUnavailable if the server cannot be reached."""
    if not enabled() or not password or not _USERNAME.match(username or ""):
        return None

    if config.LDAP_SERVER_URL.startswith("mock://"):
        return _mock_authenticate(username, password)

    from ldap3 import Connection, Server
    from ldap3.core.exceptions import LDAPBindError, LDAPException
    from ldap3.utils.conv import escape_filter_chars

    safe = escape_filter_chars(username)
    bind_user = config.LDAP_BIND_TEMPLATE.format(username=safe)
    server = Server(config.LDAP_SERVER_URL, connect_timeout=config.LDAP_TIMEOUT_SECONDS)
    try:
        connection = Connection(server, user=bind_user, password=password, auto_bind=True,
                                receive_timeout=config.LDAP_TIMEOUT_SECONDS)
    except LDAPBindError:
        return None
    except LDAPException as exc:
        logger.warning("LDAP server unavailable", extra={"fields": {"error": type(exc).__name__}})
        raise LdapUnavailable() from exc

    try:
        email, groups = f"{username}@directory.local", []
        if config.LDAP_SEARCH_BASE:
            connection.search(
                config.LDAP_SEARCH_BASE,
                config.LDAP_USER_FILTER.format(username=safe),
                attributes=[config.LDAP_EMAIL_ATTRIBUTE, "memberOf"],
                size_limit=1,
            )
            if connection.entries:
                entry = connection.entries[0]
                values = entry.entry_attributes_as_dict
                email = (values.get(config.LDAP_EMAIL_ATTRIBUTE) or [email])[0]
                groups = [str(g) for g in values.get("memberOf", [])]
        return DirectoryUser(username, str(email), _role_for(groups))
    finally:
        connection.unbind()
