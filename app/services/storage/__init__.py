"""
app/services/storage/__init__.py - Picks a concrete StorageService based
on STORAGE_PROVIDER. Every other module imports `storage_service` from
here - never LocalStorageProvider or CloudflareR2Provider directly.
"""

from __future__ import annotations

from app.config import STORAGE_PROVIDER
from app.services.storage.base import StorageService
from app.services.storage.local_provider import LocalStorageProvider
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _build_storage_service() -> StorageService:
    if STORAGE_PROVIDER == "r2":
        from app.services.storage.r2_provider import CloudflareR2Provider
        return CloudflareR2Provider()
    if STORAGE_PROVIDER != "local":
        logger.warning("Unknown STORAGE_PROVIDER=%r — falling back to local", STORAGE_PROVIDER)
    return LocalStorageProvider()


storage_service: StorageService = _build_storage_service()

__all__ = ["StorageService", "storage_service"]
