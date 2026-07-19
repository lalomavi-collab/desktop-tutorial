"""Async Postgres access via a shared asyncpg pool.

All persistence uses the service role connection string. The pool is created
once at app startup and reused; opening a connection per turn would blow the
latency budget.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg

from app.config import get_settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create the global pool. Call once on FastAPI startup."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=5.0,
            # Register a codec so jsonb round-trips as native dict/list.
            init=_register_json,
        )
    return _pool


async def _register_json(conn: asyncpg.Connection) -> None:
    import json

    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised. Call init_pool() at startup.")
    return _pool


# ── Thin typed helpers used by the session tracker ─────────────────────────────
async def fetchrow(query: str, *args: Any) -> asyncpg.Record | None:
    async with pool().acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch(query: str, *args: Any) -> list[asyncpg.Record]:
    async with pool().acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args: Any) -> str:
    async with pool().acquire() as conn:
        return await conn.execute(query, *args)


async def match_knowledge(
    embedding: list[float], threshold: float, count: int
) -> list[asyncpg.Record]:
    """Call the SQL similarity function (pgvector cosine)."""
    # asyncpg passes the vector as its text representation.
    vec = "[" + ",".join(f"{x:.6f}" for x in embedding) + "]"
    return await fetch(
        "select * from public.match_knowledge($1::vector, $2, $3)",
        vec,
        threshold,
        count,
    )
