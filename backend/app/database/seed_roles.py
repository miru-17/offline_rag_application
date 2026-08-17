from sqlalchemy import select

from app.database.connection import SessionLocal
from app.models.role import Role


DEFAULT_ROLES = ["ADMIN", "USER", "VIEWER"]


def seed_roles():
    db = SessionLocal()

    try:
        for role_name in DEFAULT_ROLES:
            existing_role = db.scalar(
                select(Role).where(Role.name == role_name)
            )

            if not existing_role:
                db.add(Role(name=role_name))

        db.commit()

        print("Roles seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()