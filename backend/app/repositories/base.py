"""Generic base repository with common CRUD operations."""

from typing import Any, Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """Generic async repository providing CRUD helpers.

    Subclasses set ``model`` to the SQLAlchemy ORM class they manage.
    """

    model: type[T]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, id: int) -> T | None:
        """Fetch a single record by primary key."""
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        )
        return result.scalars().first()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 20,
        filters: list[Any] | None = None,
    ) -> tuple[list[T], int]:
        """Return a paginated list and the total count.

        Parameters
        ----------
        skip:
            Number of rows to skip (offset).
        limit:
            Maximum rows to return.
        filters:
            Optional list of SQLAlchemy filter expressions.
        """
        query = select(self.model)
        count_query = select(func.count()).select_from(self.model)

        if filters:
            for f in filters:
                query = query.where(f)
                count_query = count_query.where(f)

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(
            self.model.id.desc()  # type: ignore[attr-defined]
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def create(self, obj_in: dict[str, Any]) -> T:
        """Insert a new record from a dictionary of column values."""
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, id: int, obj_in: dict[str, Any]) -> T | None:
        """Update an existing record by primary key."""
        db_obj = await self.get(id)
        if db_obj is None:
            return None
        for key, value in obj_in.items():
            if hasattr(db_obj, key):
                setattr(db_obj, key, value)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, id: int) -> bool:
        """Delete a record by primary key. Returns True if deleted."""
        db_obj = await self.get(id)
        if db_obj is None:
            return False
        await self.db.delete(db_obj)
        await self.db.flush()
        return True
