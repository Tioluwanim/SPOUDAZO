"""
app/services/storage/r2_provider.py - Cloudflare R2, via boto3's S3 client
pointed at R2's S3-compatible endpoint. R2 credentials live only here and
in app.config - nothing else in the app ever sees them, and get_url()
only returns a value when R2_PUBLIC_BASE_URL is explicitly configured
(a private bucket correctly returns "" - use the streaming endpoint).

NOTE for whoever deploys this: this provider is implemented against R2's
documented S3-compatible API and unit-tested against a mocked S3 client
(see the test suite) - it has not been exercised against a live R2
bucket, since this sandbox has neither R2 credentials nor network access
to Cloudflare's API. Test against a real bucket before relying on it in
production.
"""

from __future__ import annotations

from typing import Iterator

from app.config import (
    R2_ACCESS_KEY_ID,
    R2_BUCKET_NAME,
    R2_ENDPOINT_URL,
    R2_PUBLIC_BASE_URL,
    R2_SECRET_ACCESS_KEY,
)
from app.services.storage.base import StorageService
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CloudflareR2Provider(StorageService):
    def __init__(self):
        missing = [
            name for name, value in [
                ("R2_ACCOUNT_ID / R2_ENDPOINT_URL", R2_ENDPOINT_URL),
                ("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID),
                ("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY),
                ("R2_BUCKET_NAME", R2_BUCKET_NAME),
            ] if not value
        ]
        if missing:
            raise RuntimeError(
                "STORAGE_PROVIDER=r2 but missing required config: " + ", ".join(missing)
            )

        import boto3
        self._client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            # R2 only supports (and requires) this region literal - it has no
            # real regions, but the S3 API requires the parameter.
            region_name="auto",
        )
        self._bucket = R2_BUCKET_NAME
        logger.info("CloudflareR2Provider ready (bucket=%s)", self._bucket)

    def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data, ContentType=content_type)
        return self.get_url(key)

    def download(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def stream(self, key: str, range_header: str | None = None) -> tuple[Iterator[bytes], int, int, int]:
        # HEAD first to get the true total size regardless of whether this
        # call is ranged - needed for the Content-Range response header.
        head = self._client.head_object(Bucket=self._bucket, Key=key)
        total_size = head["ContentLength"]

        get_kwargs = {"Bucket": self._bucket, "Key": key}
        if range_header:
            get_kwargs["Range"] = range_header

        response = self._client.get_object(**get_kwargs)
        body = response["Body"]

        if range_header and "ContentRange" in response:
            # e.g. "bytes 0-1023/50000"
            spec = response["ContentRange"].split(" ")[1].split("/")[0]
            start_str, end_str = spec.split("-")
            start, end = int(start_str), int(end_str)
        else:
            start, end = 0, total_size - 1

        def _iter(chunk_size: int = 64 * 1024) -> Iterator[bytes]:
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk

        return _iter(), start, end, total_size

    def delete(self, key: str) -> bool:
        # S3-compatible delete_object doesn't error on a missing key, so
        # check existence first to give an honest True/False back.
        if not self.exists(key):
            return False
        self._client.delete_object(Bucket=self._bucket, Key=key)
        return True

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
                return False
            raise

    def get_url(self, key: str) -> str:
        if not R2_PUBLIC_BASE_URL:
            return ""
        return f"{R2_PUBLIC_BASE_URL.rstrip('/')}/{key}"
