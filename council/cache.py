from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from .exceptions import CacheError
from .logging_config import get_cache_logger

logger = get_cache_logger()


@dataclass
class CacheRecord:
    provider: str
    prompt: str
    response: str
    metadata: Dict[str, Any]


class SQLiteCache:
    """
    Lightweight SQLite-backed cache for model responses.
    """

    def __init__(self, database: Path | str = "council_cache.db") -> None:
        self.database = Path(database)
        self._lock = threading.Lock()
        self._ensure_tables()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.database)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_tables(self) -> None:
        try:
            with self._connect() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS responses (
                        provider TEXT NOT NULL,
                        prompt_hash TEXT NOT NULL,
                        prompt TEXT NOT NULL,
                        response TEXT NOT NULL,
                        metadata TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (provider, prompt_hash)
                    );
                    """
                )
                conn.commit()
                logger.debug("Cache tables initialized", extra={"database": str(self.database)})
        except sqlite3.Error as exc:
            logger.error(
                "Failed to initialize cache tables",
                extra={"database": str(self.database), "error": str(exc)}
            )
            raise CacheError(
                f"Failed to initialize cache database: {exc}",
                cache_operation="initialize",
                suggestion="Check database file permissions and disk space",
                original_error=exc
            )

    def build_prompt_hash(self, prompt: str) -> str:
        return hashlib.sha256(prompt.encode("utf-8")).hexdigest()

    def get(self, provider: str, prompt: str) -> Optional[CacheRecord]:
        prompt_hash = self.build_prompt_hash(prompt)
        try:
            with self._lock, self._connect() as conn:
                row = conn.execute(
                    "SELECT provider, prompt, response, metadata FROM responses WHERE provider = ? AND prompt_hash = ?",
                    (provider, prompt_hash),
                ).fetchone()
                
                if not row:
                    logger.debug(
                        "Cache miss",
                        extra={"provider": provider, "prompt_hash": prompt_hash[:8]}
                    )
                    return None
                
                metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                logger.debug(
                    "Cache hit",
                    extra={
                        "provider": provider,
                        "prompt_hash": prompt_hash[:8],
                        "response_length": len(row["response"])
                    }
                )
                
                return CacheRecord(
                    provider=row["provider"],
                    prompt=row["prompt"],
                    response=row["response"],
                    metadata=metadata
                )
        except sqlite3.Error as exc:
            logger.warning(
                "Cache get operation failed",
                extra={
                    "provider": provider,
                    "prompt_hash": prompt_hash[:8],
                    "error": str(exc)
                }
            )
            # Return None instead of raising to allow graceful degradation
            return None

    def set(self, provider: str, prompt: str, response: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        prompt_hash = self.build_prompt_hash(prompt)
        try:
            with self._lock, self._connect() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO responses (provider, prompt_hash, prompt, response, metadata)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (provider, prompt_hash, prompt, response, json.dumps(metadata or {})),
                )
                conn.commit()
                
                logger.debug(
                    "Cache set successful",
                    extra={
                        "provider": provider,
                        "prompt_hash": prompt_hash[:8],
                        "response_length": len(response),
                        "has_metadata": bool(metadata)
                    }
                )
        except sqlite3.Error as exc:
            logger.warning(
                "Cache set operation failed",
                extra={
                    "provider": provider,
                    "prompt_hash": prompt_hash[:8],
                    "error": str(exc)
                }
            )
            # Don't raise exception to allow graceful degradation
            # The system can continue without caching
