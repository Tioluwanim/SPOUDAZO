"""
app/services/storage/base.py - The StorageService interface.

Every part of the app that needs to read/write an uploaded file's bytes
depends on THIS, never on LocalStorageProvider or CloudflareR2Provider
directly. Swapping the backing store is a config change (STORAGE_PROVIDER),
not a code change anywhere else - pdf_service, the materials API, and the
reader endpoints only ever import `storage_service` from
app.services.storage (see __init__.py's factory).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterator


class StorageService(ABC):
    @abstractmethod
    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Stores `data` under `key`. Returns a storage_url - for local
        storage this is a file:// style local reference; for R2 it's
        either a public URL (if a public base URL is configured) or an
        empty string (files still served through our own streaming
        endpoint either way, so this is informational, not load-bearing)."""

    @abstractmethod
    def download(self, key: str) -> bytes:
        """Reads the whole object into memory - fine for the sizes this
        app deals with (MAX_FILE_SIZE_MB-capped lecture PDFs), not meant
        for anything that needs true zero-copy streaming."""

    @abstractmethod
    def stream(self, key: str, range_header: str | None = None) -> tuple[Iterator[bytes], int, int, int]:
        """Returns (byte_iterator, start, end, total_size) honoring an
        HTTP Range header (e.g. "bytes=0-1023") when given, so the PDF
        viewer can request just the byte ranges it needs instead of
        downloading the whole file up front. Without a range_header,
        start=0 and end=total_size-1 (the whole object)."""

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Returns True if something was deleted, False if the key never existed."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        ...

    @abstractmethod
    def get_url(self, key: str) -> str:
        """Best-effort direct URL for this object, or "" if none is safe
        to hand out (e.g. a private R2 bucket with no public base URL
        configured) - callers must treat "" as "use the streaming
        endpoint instead", not as an error."""
