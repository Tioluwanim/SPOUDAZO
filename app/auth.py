"""
app/auth.py - Firebase ID token verification.

Every endpoint that used to trust a client-supplied `user_id` string
(spoofable by editing localStorage) now depends on `get_current_user_id`
instead, which verifies a real Firebase ID token sent as
`Authorization: Bearer <token>` and returns the UID Firebase itself
vouches for. If the token is missing, malformed, or invalid, the
request is rejected with 401 before it ever reaches your business logic.

Setup: create a Firebase project (free Spark plan), enable
Authentication -> Sign-in method -> Email/Password, then generate a
service account key (Project Settings -> Service Accounts -> Generate
new private key). Base64-encode that JSON file's contents and set it as
FIREBASE_SERVICE_ACCOUNT_B64 in .env - base64 avoids the multiline-JSON-
in-a-.env-file problem, which is a common source of "works locally,
breaks after a copy-paste" bugs.

    # macOS/Linux:
    base64 -i serviceAccountKey.json | tr -d '\n'
    # Windows PowerShell:
    [Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))

Paste the output as one line: FIREBASE_SERVICE_ACCOUNT_B64=eyJ0eXBl...
"""

from __future__ import annotations

import base64
import json
import os

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.utils.logger import get_logger

logger = get_logger(__name__)

_app: firebase_admin.App | None = None


def _init_firebase() -> firebase_admin.App | None:
    """Lazy init so importing this module doesn't crash when credentials
    aren't configured yet (e.g. first-time local setup, or CI running
    other tests that don't touch auth)."""
    global _app
    if _app is not None:
        return _app

    b64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_B64", "").strip()
    if not b64:
        logger.warning(
            "FIREBASE_SERVICE_ACCOUNT_B64 not set - auth-protected endpoints "
            "will reject every request until this is configured."
        )
        return None

    try:
        raw = base64.b64decode(b64).decode("utf-8")
        service_account_info = json.loads(raw)
        cred = credentials.Certificate(service_account_info)
        _app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialised for project '%s'", service_account_info.get("project_id"))
        return _app
    except Exception as e:
        logger.error("Failed to initialise Firebase Admin: %s", e)
        return None


def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency - verifies the Firebase ID token and returns the
    UID. Use as `user_id: str = Depends(get_current_user_id)` on any
    endpoint that needs to know who's calling."""
    app = _init_firebase()
    if app is None:
        raise HTTPException(500, "Auth is not configured on the server (missing FIREBASE_SERVICE_ACCOUNT_B64)")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header - expected 'Bearer <id_token>'")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        decoded = firebase_auth.verify_id_token(token, app=app)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(401, "Session expired - please sign in again")
    except Exception as e:
        logger.warning("Firebase token verification failed: %s", e)
        raise HTTPException(401, "Invalid authentication token")

    return decoded["uid"]
