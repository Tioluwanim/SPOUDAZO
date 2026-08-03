"""
app/services/storage/local_provider.py - Default provider, backward
compatible with every document uploaded before this feature existed.

Writes land in exactly the same place pdf_service used to write them
directly (UPLOAD_DIR/<key>), so Document.local_path continues to be a
valid, directly-readable path for local-provider documents - nothing
that already reads local_path elsewhere in the codebase needs to change.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from app.config import UPLOAD_DIR
from app.services.storage.base import StorageService


class LocalStorageProvider(StorageService):
    def __init__(self, base_dir: Path | None = None):
        self.base_dir = base_dir or UPLOAD_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # key may itself contain subdirectories (e.g. "documents/<doc_id>/file.pdf") -
        # normalize away any leading slash and disallow escaping base_dir.
        clean = key.lstrip("/")
        path = (self.base_dir / clean).resolve()
        if self.base_dir.resolve() not in path.parents and path != self.base_dir.resolve():
            raise ValueError(f"Storage key '{key}' resolves outside the storage root")
        return path

    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"file://{path}"

    def download(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def stream(self, key: str, range_header: str | None = None) -> tuple[Iterator[bytes], int, int, int]:
        path = self._path(key)
        total_size = path.stat().st_size
        start, end = 0, total_size - 1

        if range_header and range_header.startswith("bytes="):
            range_spec = range_header.removeprefix("bytes=")
            start_str, _, end_str = range_spec.partition("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else total_size - 1
            end = min(end, total_size - 1)

        def _iter(chunk_size: int = 64 * 1024) -> Iterator[bytes]:
            with path.open("rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return _iter(), start, end, total_size

    def delete(self, key: str) -> bool:
        path = self._path(key)
        if not path.exists():
            return False
        path.unlink()
        return True

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def get_url(self, key: str) -> str:
        # No public HTTP URL for local disk - callers use the streaming endpoint.
        return ""
