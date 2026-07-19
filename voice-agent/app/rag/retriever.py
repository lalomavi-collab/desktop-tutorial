"""Retrieval-Augmented Generation over the pgvector knowledge base.

The retriever embeds the caller's latest utterance and pulls the top-k public
chunks above the similarity threshold. Only public rows are returned (the SQL
function enforces this too), honouring the Sandbox Guardrail: the agent may
never ground an answer in confidential data.
"""
from __future__ import annotations

import logging

import httpx

from app.config import Settings, get_settings
from app.models import KnowledgeChunk
from app.state import db

log = logging.getLogger("voice_agent.rag")


class Embedder:
    """Async embedding client. Provider is swappable via EMBEDDING_PROVIDER."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._s = settings
        self._client = client

    async def embed(self, text: str) -> list[float]:
        if self._s.embedding_provider == "openai":
            return await self._embed_openai(text)
        raise RuntimeError(f"Unsupported embedding provider: {self._s.embedding_provider}")

    async def _embed_openai(self, text: str) -> list[float]:
        resp = await self._client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {self._s.openai_api_key}"},
            json={"model": self._s.embedding_model, "input": text},
            timeout=3.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


class Retriever:
    def __init__(self, embedder: Embedder, settings: Settings | None = None) -> None:
        self._embedder = embedder
        self._s = settings or get_settings()

    async def retrieve(self, query: str) -> list[KnowledgeChunk]:
        """Return grounding chunks for a query, or an empty list on any failure.

        Retrieval never raises into the audio path: if embeddings or the vector
        search fail, the agent proceeds with no context and the guardrails keep
        it from inventing facts.
        """
        try:
            embedding = await self._embedder.embed(query)
        except Exception as exc:  # noqa: BLE001 - degrade gracefully
            log.warning("Embedding failed, proceeding without RAG: %s", exc)
            return []

        try:
            rows = await db.match_knowledge(
                embedding, self._s.rag_similarity_threshold, self._s.rag_top_k
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Vector search failed, proceeding without RAG: %s", exc)
            return []

        return [
            KnowledgeChunk(
                id=r["id"], source=r["source"], title=r["title"],
                content=r["content"], category=r["category"], similarity=r["similarity"],
            )
            for r in rows
        ]

    @staticmethod
    def format_context(chunks: list[KnowledgeChunk]) -> str:
        """Render retrieved chunks as a compact, citable context block."""
        if not chunks:
            return "NO_CONTEXT_FOUND"
        lines: list[str] = []
        for i, c in enumerate(chunks, start=1):
            head = c.title or c.source
            lines.append(f"[{i}] ({c.category}) {head}\n{c.content.strip()}")
        return "\n\n".join(lines)
