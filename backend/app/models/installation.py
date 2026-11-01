from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.connection import Base


class Installation(Base):
    """
    One row per RAGENTIS installation. Its random ID is what a licence can be
    bound to. It lives in the database, so a backup restored on a new server
    (disaster recovery) keeps working, while the same licence file installed
    on a different, fresh installation is refused.
    """

    __tablename__ = "installation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    installation_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
