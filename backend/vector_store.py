"""
Qdrant Vector Store Module

Provides semantic search and RAG retrieval for:
- Similar conversation lookup
- Knowledge entry retrieval
- Document embeddings

All operations fail gracefully if Qdrant is unavailable.
"""

import hashlib
import httpx
from typing import Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse

from .config import (
    QDRANT_URL,
    QDRANT_API_KEY,
    QDRANT_ENABLED,
    QDRANT_COLLECTION_CONVERSATIONS,
    QDRANT_COLLECTION_KNOWLEDGE,
    QDRANT_COLLECTION_DOCUMENTS,
    EMBEDDING_DIMENSIONS,
    OPENROUTER_API_KEY,
)
from .security import log_error, log_app_event

# Global client instance
_qdrant_client: Optional[QdrantClient] = None


def get_qdrant() -> Optional[QdrantClient]:
    """
    Get Qdrant client instance with lazy initialization.
    Returns None if Qdrant is disabled or connection fails.
    """
    global _qdrant_client

    if not QDRANT_ENABLED:
        return None

    if _qdrant_client is not None:
        return _qdrant_client

    try:
        # Initialize client based on URL type
        if QDRANT_API_KEY and "cloud.qdrant.io" in QDRANT_URL:
            # Qdrant Cloud connection
            _qdrant_client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY,
                timeout=30,
            )
        else:
            # Local Qdrant connection
            _qdrant_client = QdrantClient(
                url=QDRANT_URL,
                timeout=30,
            )

        # Verify connection
        _qdrant_client.get_collections()
        log_app_event("qdrant_connected", level="INFO", details={"url": QDRANT_URL})
        return _qdrant_client

    except Exception as e:
        log_error("qdrant_connection", e, details={"url": QDRANT_URL})
        _qdrant_client = None
        return None


def close_qdrant():
    """Close Qdrant client connection."""
    global _qdrant_client
    if _qdrant_client is not None:
        try:
            _qdrant_client.close()
        except Exception:
            pass
        _qdrant_client = None
        log_app_event("qdrant_closed", level="INFO")


async def ensure_collections():
    """
    Ensure all required collections exist with proper configuration.
    Creates collections if they don't exist.
    Also creates payload indexes required for filtering.
    """
    client = get_qdrant()
    if client is None:
        return False

    collections = [
        QDRANT_COLLECTION_CONVERSATIONS,
        QDRANT_COLLECTION_KNOWLEDGE,
        QDRANT_COLLECTION_DOCUMENTS,
    ]

    try:
        existing = {c.name for c in client.get_collections().collections}

        for collection_name in collections:
            if collection_name not in existing:
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=EMBEDDING_DIMENSIONS,
                        distance=models.Distance.COSINE,
                    ),
                )
                log_app_event("qdrant_collection_created", level="INFO", details={"collection": collection_name})
            else:
                log_app_event("qdrant_collection_exists", level="INFO", details={"collection": collection_name})

            # Create payload index for company_id filtering (required for filtered searches)
            try:
                client.create_payload_index(
                    collection_name=collection_name,
                    field_name="company_id",
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
                log_app_event("qdrant_index_created", level="INFO", details={"collection": collection_name, "field": "company_id"})
            except Exception as index_err:
                # Index might already exist - that's fine
                if "already exists" not in str(index_err).lower():
                    log_app_event("qdrant_index_note", level="WARNING", details={"collection": collection_name, "error": str(index_err)})

        return True

    except Exception as e:
        log_error("qdrant_ensure_collections", e)
        return False


async def get_embedding(text: str) -> Optional[list[float]]:
    """
    Get embedding vector for text using OpenRouter's embedding API.
    Returns None if embedding fails.
    """
    if not OPENROUTER_API_KEY:
        log_app_event("qdrant_no_api_key", level="WARNING", details={"service": "embeddings"})
        return None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "openai/text-embedding-3-small",
                    "input": text[:8000],  # Truncate to avoid token limits
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]

    except Exception as e:
        log_error("qdrant_embedding", e)
        return None


def make_point_id(text: str, prefix: str = "") -> str:
    """Generate a deterministic point ID from text."""
    content = f"{prefix}:{text}" if prefix else text
    return hashlib.sha256(content.encode()).hexdigest()[:32]


async def upsert_conversation(
    conversation_id: str,
    query: str,
    response_summary: str,
    company_id: str,
    metadata: Optional[dict] = None,
) -> bool:
    """
    Store or update a conversation embedding for semantic search.
    """
    client = get_qdrant()
    if client is None:
        return False

    # Combine query and response for embedding
    text = f"Query: {query}\n\nResponse: {response_summary}"
    embedding = await get_embedding(text)
    if embedding is None:
        return False

    try:
        payload = {
            "conversation_id": conversation_id,
            "company_id": company_id,
            "query": query[:500],  # Truncate for storage
            "response_preview": response_summary[:500],
            **(metadata or {}),
        }

        client.upsert(
            collection_name=QDRANT_COLLECTION_CONVERSATIONS,
            points=[
                models.PointStruct(
                    id=make_point_id(conversation_id, "conv"),
                    vector=embedding,
                    payload=payload,
                )
            ],
        )
        return True

    except Exception as e:
        log_error("qdrant_upsert_conversation", e, resource_id=conversation_id)
        return False


async def upsert_knowledge_entry(
    entry_id: str,
    title: str,
    content: str,
    company_id: str,
    metadata: Optional[dict] = None,
) -> bool:
    """
    Store or update a knowledge entry embedding.
    """
    client = get_qdrant()
    if client is None:
        return False

    text = f"{title}\n\n{content}"
    embedding = await get_embedding(text)
    if embedding is None:
        return False

    try:
        payload = {
            "entry_id": entry_id,
            "company_id": company_id,
            "title": title,
            "content_preview": content[:500],
            **(metadata or {}),
        }

        client.upsert(
            collection_name=QDRANT_COLLECTION_KNOWLEDGE,
            points=[
                models.PointStruct(
                    id=make_point_id(entry_id, "knowledge"),
                    vector=embedding,
                    payload=payload,
                )
            ],
        )
        return True

    except Exception as e:
        log_error("qdrant_upsert_knowledge", e, resource_id=entry_id)
        return False


async def search_similar_conversations(
    query: str,
    company_id: str,
    limit: int = 5,
    score_threshold: float = 0.7,
) -> list[dict]:
    """
    Find similar conversations for RAG context.
    Returns list of conversation metadata with similarity scores.
    """
    client = get_qdrant()
    if client is None:
        return []

    embedding = await get_embedding(query)
    if embedding is None:
        return []

    try:
        results = client.query_points(
            collection_name=QDRANT_COLLECTION_CONVERSATIONS,
            query=embedding,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="company_id",
                        match=models.MatchValue(value=company_id),
                    )
                ]
            ),
            limit=limit,
            score_threshold=score_threshold,
        )

        return [
            {
                "conversation_id": r.payload.get("conversation_id") if r.payload else None,
                "query": r.payload.get("query") if r.payload else None,
                "response_preview": r.payload.get("response_preview") if r.payload else None,
                "score": r.score,
            }
            for r in results.points
        ]

    except Exception as e:
        log_error("qdrant_search_conversations", e, details={"company_id": company_id, "query_preview": query[:50]})
        return []


async def search_knowledge(
    query: str,
    company_id: str,
    limit: int = 5,
    score_threshold: float = 0.7,
) -> list[dict]:
    """
    Find relevant knowledge entries for RAG context.
    """
    client = get_qdrant()
    if client is None:
        return []

    embedding = await get_embedding(query)
    if embedding is None:
        return []

    try:
        results = client.query_points(
            collection_name=QDRANT_COLLECTION_KNOWLEDGE,
            query=embedding,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="company_id",
                        match=models.MatchValue(value=company_id),
                    )
                ]
            ),
            limit=limit,
            score_threshold=score_threshold,
        )

        return [
            {
                "entry_id": r.payload.get("entry_id") if r.payload else None,
                "title": r.payload.get("title") if r.payload else None,
                "content_preview": r.payload.get("content_preview") if r.payload else None,
                "score": r.score,
            }
            for r in results.points
        ]

    except Exception as e:
        log_error("qdrant_search_knowledge", e, details={"company_id": company_id, "query_preview": query[:50]})
        return []


async def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation from the vector store."""
    client = get_qdrant()
    if client is None:
        return False

    try:
        client.delete(
            collection_name=QDRANT_COLLECTION_CONVERSATIONS,
            points_selector=models.PointIdsList(
                points=[make_point_id(conversation_id, "conv")],
            ),
        )
        return True
    except Exception as e:
        log_error("qdrant_delete_conversation", e, resource_id=conversation_id)
        return False


async def delete_knowledge_entry(entry_id: str) -> bool:
    """Delete a knowledge entry from the vector store."""
    client = get_qdrant()
    if client is None:
        return False

    try:
        client.delete(
            collection_name=QDRANT_COLLECTION_KNOWLEDGE,
            points_selector=models.PointIdsList(
                points=[make_point_id(entry_id, "knowledge")],
            ),
        )
        return True
    except Exception as e:
        log_error("qdrant_delete_knowledge", e, resource_id=entry_id)
        return False


def get_vector_store_health() -> dict:
    """
    Get health status of vector store.
    Returns dict with status, collections, and point counts.
    """
    client = get_qdrant()
    if client is None:
        return {
            "status": "disabled" if not QDRANT_ENABLED else "disconnected",
            "collections": [],
        }

    try:
        collections_info = []
        for collection in client.get_collections().collections:
            info = client.get_collection(collection.name)
            collections_info.append({
                "name": collection.name,
                "points_count": info.points_count,
            })

        return {
            "status": "connected",
            "url": QDRANT_URL,
            "collections": collections_info,
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "collections": [],
        }
