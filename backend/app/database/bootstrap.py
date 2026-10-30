"""
Prepare the database when the backend starts.

Safe to run on every start:
    * Existing database managed by Alembic
          -> only applies new migrations (nothing is dropped or reset).
    * Empty database (new machine / new Docker volume)
          -> creates all tables from the models and marks Alembic as up to date.
    * Default roles (ADMIN, USER, VIEWER) and the "Default Tenant"
          -> created only if they are missing.

Run manually with:
    python -m app.database.bootstrap
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.database.connection import Base, SessionLocal, engine
from app.models.role import Role
from app.models.tenant import Tenant


ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"

DEFAULT_ROLES = ["ADMIN", "USER", "VIEWER"]
DEFAULT_TENANT_NAME = "Default Tenant"


def prepare_schema() -> None:
    alembic_cfg = Config(str(ALEMBIC_INI))
    existing_tables = set(inspect(engine).get_table_names())

    if "alembic_version" in existing_tables:
        # Database already managed by Alembic: apply only new migrations.
        command.upgrade(alembic_cfg, "head")
        print("Database schema: existing database, migrations up to date.")
        return

    # New (or create_all-built) database: create missing tables only.
    Base.metadata.create_all(bind=engine)
    command.stamp(alembic_cfg, "head")
    print("Database schema: tables created and Alembic stamped at head.")


def seed_defaults() -> None:
    db = SessionLocal()

    try:
        for role_name in DEFAULT_ROLES:
            if not db.scalar(select(Role).where(Role.name == role_name)):
                db.add(Role(name=role_name))

        if not db.scalar(
            select(Tenant).where(Tenant.name == DEFAULT_TENANT_NAME)
        ):
            db.add(Tenant(name=DEFAULT_TENANT_NAME))

        db.commit()
        print("Default roles and tenant are present.")

    finally:
        db.close()


def report_license_key() -> None:
    from app.core.config import LICENSE_PUBLIC_KEY_PATH

    if not LICENSE_PUBLIC_KEY_PATH.exists():
        print(
            "WARNING: no licence public key found at "
            f"{LICENSE_PUBLIC_KEY_PATH}. Run 'python tools/license_issuer.py init-keys' "
            "on the vendor machine, then rebuild. Upload and chat stay locked until "
            "a signed licence is installed."
        )


def main() -> None:
    prepare_schema()
    seed_defaults()
    report_license_key()


if __name__ == "__main__":
    main()
