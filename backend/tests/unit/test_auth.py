"""Unit tests for password hashing, JWT creation/decoding, and webhook signature verification."""

import hashlib
import hmac
import pytest
from fastapi import HTTPException

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_oauth_state,
    hash_password,
    verify_oauth_state,
    verify_password,
    verify_webhook_signature,
)


class TestPasswordHashing:
    """Password hashing and verification tests."""

    def test_hash_password_produces_bcrypt_hash(self) -> None:
        raw_pw = "supersecretpassword123"
        hashed = hash_password(raw_pw)
        assert hashed != raw_pw
        assert hashed.startswith("$2")

    def test_verify_password_valid(self) -> None:
        raw_pw = "supersecretpassword123"
        hashed = hash_password(raw_pw)
        assert verify_password(raw_pw, hashed) is True

    def test_verify_password_invalid(self) -> None:
        raw_pw = "supersecretpassword123"
        hashed = hash_password(raw_pw)
        assert verify_password("wrongpassword", hashed) is False


class TestJWTTokens:
    """JWT token creation and parsing tests."""

    def test_create_and_decode_access_token(self) -> None:
        payload = {"sub": "42", "role": "admin", "type": "access"}
        token = create_access_token(payload)
        assert isinstance(token, str)

        decoded = decode_token(token)
        assert decoded["sub"] == "42"
        assert decoded["role"] == "admin"
        assert decoded["type"] == "access"
        assert "exp" in decoded

    def test_create_and_decode_refresh_token(self) -> None:
        payload = {"sub": "42", "type": "refresh"}
        token = create_refresh_token(payload)
        decoded = decode_token(token)
        assert decoded["sub"] == "42"
        assert decoded["type"] == "refresh"

    def test_decode_invalid_token_raises_exception(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            decode_token("not.a.valid.jwt.token")
        assert exc_info.value.status_code == 401


class TestWebhookSignatureVerification:
    """HMAC-SHA256 signature verification tests."""

    def test_valid_signature_accepted(self) -> None:
        secret = "secret-token-12345"
        payload = b'{"action": "completed", "workflow_run": {"id": 999}}'
        computed_sig = (
            "sha256="
            + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        )
        assert verify_webhook_signature(payload, computed_sig, secret) is True

    def test_invalid_signature_rejected(self) -> None:
        secret = "secret-token-12345"
        payload = b'{"action": "completed"}'
        assert (
            verify_webhook_signature(
                payload, "sha256=0000000000000000000000000000000000000000", secret
            )
            is False
        )

    def test_missing_sha256_prefix_rejected(self) -> None:
        secret = "secret-token-12345"
        payload = b'{"action": "completed"}'
        assert verify_webhook_signature(payload, "invalid_prefix_signature", secret) is False


class TestOAuthStateCSRFVerification:
    """OAuth state generation and CSRF verification tests."""

    def test_generated_oauth_state_is_valid(self) -> None:
        state = generate_oauth_state()
        assert state is not None
        assert verify_oauth_state(state) is True

    def test_tampered_oauth_state_rejected(self) -> None:
        state = generate_oauth_state()
        tampered_state = state[:-4] + "ffff"
        assert verify_oauth_state(tampered_state) is False

    def test_expired_or_invalid_format_state_rejected(self) -> None:
        assert verify_oauth_state(None) is False
        assert verify_oauth_state("") is False
        assert verify_oauth_state("invalid:format") is False
        # Timestamp far in the past (more than 600s ago)
        old_state = "1000000000:abcd1234efgh5678:valid_looking_hex"
        assert verify_oauth_state(old_state) is False

