"""
Emergency password reset for a RAGENTIS account (forgotten administrator password).
Runs inside the backend container; the new password comes from NEW_PASSWORD.

Windows (Command Prompt, in the project folder):
    set "NEW_PASSWORD=YourNewPassword123"
    docker compose exec -T -e NEW_PASSWORD backend python - <username> < scripts\reset_admin_password.py

Linux / WSL:
    NEW_PASSWORD='YourNewPassword123' docker compose exec -T -e NEW_PASSWORD backend python - <username> < scripts/reset_admin_password.py

The account is also unlocked, its sessions end, and the reset is written to the
audit log. Anyone who can run docker commands on this computer can do this,
so keep access to the server limited to IT.
"""
import os
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.database.connection import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.services import audit_service, session_service

if len(sys.argv) != 2:
    sys.exit("Usage: ... python - <username> < scripts/reset_admin_password.py")
username = sys.argv[1]
password = os.environ.get("NEW_PASSWORD", "")
if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
    sys.exit("Set NEW_PASSWORD first: at least 8 characters with a letter and a number.")

db = SessionLocal()
try:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        admins = db.execute(select(User.username).join(Role, Role.id == User.role_id)
                            .where(Role.name == "ADMIN")).scalars().all()
        sys.exit(f"No account named '{username}'. Administrator accounts: {', '.join(admins) or 'none'}")
    if user.auth_source == "ldap":
        sys.exit(f"'{username}' signs in with Active Directory; reset the password there.")
    user.password_hash = hash_password(password)
    user.failed_login_count = 0
    user.locked_until = None
    user.is_active = True
    user.must_change_password = False
    user.token_version = (user.token_version or 0) + 1
    session_service.revoke_all_for_user(db, user.id)
    db.commit()
    audit_service.record("user.password_reset", actor_username="server-console", tenant_id=user.tenant_id,
                         target_type="user", target_id=user.id, target_label=user.username,
                         details={"method": "reset_admin_password script"})
    print(f"Password for '{username}' changed. The account is unlocked. Sign in with the new password.")
finally:
    db.close()
