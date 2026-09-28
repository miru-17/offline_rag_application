from datetime import datetime, timezone
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.license import License


class LicenseService:

    # ========================================================
    # GENERATE LICENSE KEY
    # ========================================================

    @staticmethod
    def generate_license_key() -> str:
        return (
            f"OFFLINE-RAG-"
            f"{secrets.token_hex(4).upper()}-"
            f"{secrets.token_hex(4).upper()}-"
            f"{secrets.token_hex(4).upper()}"
        )


    # ========================================================
    # CREATE LICENSE
    # ========================================================

    @staticmethod
    def create_license(
        db: Session,
        tenant_id,
        expires_at: datetime,
    ) -> License:

        license_key = (
            LicenseService.generate_license_key()
        )

        license = License(
            license_key=license_key,
            tenant_id=tenant_id,
            issued_at=datetime.now(
                timezone.utc
            ).replace(tzinfo=None),
            expires_at=expires_at,
            is_active=True,
        )

        db.add(license)
        db.commit()
        db.refresh(license)

        return license


    # ========================================================
    # GET TENANT LICENSE
    # ========================================================

    @staticmethod
    def get_license(
        db: Session,
        tenant_id,
    ) -> License | None:

        return db.scalar(
            select(License).where(
                License.tenant_id == tenant_id
            )
        )


    # ========================================================
    # CHECK LICENSE VALIDITY
    # ========================================================

    @staticmethod
    def is_license_valid(
        db: Session,
        tenant_id,
    ) -> bool:

        license = LicenseService.get_license(
            db=db,
            tenant_id=tenant_id,
        )

        if license is None:
            return False

        if not license.is_active:
            return False

        now = datetime.now(
            timezone.utc
        ).replace(tzinfo=None)

        if license.expires_at <= now:
            return False

        return True


    # ========================================================
    # VALIDATE LICENSE
    # ========================================================

    @staticmethod
    def validate_license(
        db: Session,
        tenant_id,
    ) -> License:

        license = LicenseService.get_license(
            db=db,
            tenant_id=tenant_id,
        )

        if license is None:
            raise ValueError(
                "No license found for this tenant."
            )

        if not license.is_active:
            raise ValueError(
                "License is inactive."
            )

        now = datetime.now(
            timezone.utc
        ).replace(tzinfo=None)

        if license.expires_at <= now:
            raise ValueError(
                "License has expired."
            )

        return license


    # ========================================================
    # EXTEND / UPDATE LICENSE
    # ========================================================

    @staticmethod
    def extend_license(
        db: Session,
        tenant_id,
        days: int | None = None,
        expires_at: datetime | None = None,
    ) -> License:

        # ----------------------------------------------------
        # Get existing license
        # ----------------------------------------------------

        license = LicenseService.get_license(
            db=db,
            tenant_id=tenant_id,
        )

        if license is None:
            raise ValueError(
                "No license found for this tenant."
            )


        # ----------------------------------------------------
        # Validate that at least one update
        # option was supplied
        # ----------------------------------------------------

        if days is None and expires_at is None:
            raise ValueError(
                "Provide either days or expires_at."
            )


        # ----------------------------------------------------
        # Both values should not be supplied
        # simultaneously
        # ----------------------------------------------------

        if (
            days is not None
            and expires_at is not None
        ):
            raise ValueError(
                "Provide either days or expires_at, not both."
            )


        # ====================================================
        # OPTION 1 — EXTEND BY NUMBER OF DAYS
        # ====================================================

        if days is not None:

            if days <= 0:
                raise ValueError(
                    "Extension days must be greater than zero."
                )

            current_expiry = license.expires_at

            if current_expiry.tzinfo is None:
                current_expiry = (
                    current_expiry.replace(
                        tzinfo=timezone.utc
                    )
                )

            new_expiry = (
                current_expiry
                + __import__(
                    "datetime"
                ).timedelta(days=days)
            )

            license.expires_at = (
                new_expiry.astimezone(
                    timezone.utc
                ).replace(tzinfo=None)
            )


        # ====================================================
        # OPTION 2 — SET SPECIFIC EXPIRY DATE
        # ====================================================

        elif expires_at is not None:

            if expires_at.tzinfo is None:
                expires_at = (
                    expires_at.replace(
                        tzinfo=timezone.utc
                    )
                )

            expires_at = (
                expires_at.astimezone(
                    timezone.utc
                )
            )

            now = datetime.now(
                timezone.utc
            )

            if expires_at <= now:
                raise ValueError(
                    "License expiry must be in the future."
                )

            license.expires_at = (
                expires_at.replace(
                    tzinfo=None
                )
            )


        # ====================================================
        # REACTIVATE LICENSE
        # ====================================================

        license.is_active = True


        # ====================================================
        # SAVE
        # ====================================================

        db.commit()
        db.refresh(license)

        return license