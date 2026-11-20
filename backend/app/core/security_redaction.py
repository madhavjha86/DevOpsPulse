"""Security redaction engine preventing sensitive secrets from entering AI context."""

from __future__ import annotations

import re
from typing import Any

# Regular expression patterns for common sensitive credentials
REDACTION_PATTERNS = [
    # Authorization & Bearer tokens
    (re.compile(r"(Bearer\s+)[A-Za-z0-9\-_\.=]{15,}", re.IGNORECASE), r"\1[REDACTED_BEARER_TOKEN]"),
    (re.compile(r"(Basic\s+)[A-Za-z0-9+/=]{10,}", re.IGNORECASE), r"\1[REDACTED_BASIC_AUTH]"),
    
    # Generic password / secret / token assignments in key=value, JSON, or YAML
    (re.compile(r'(["\']?(?:password|passwd|secret|token|api_?key|auth_?token|client_?secret)["\']?\s*[:=]\s*["\'])([^"\'\s]+)(["\'])', re.IGNORECASE), r'\1[REDACTED_SECRET]\3'),
    
    # AWS Access Key ID and Secret Access Key
    (re.compile(r"\b(AKIA[0-9A-Z]{16})\b"), r"[REDACTED_AWS_ACCESS_KEY]"),
    (re.compile(r'(["\']?aws_secret_access_key["\']?\s*[:=]\s*["\']?)[A-Za-z0-9/+=]{40}(["\']?)', re.IGNORECASE), r'\1[REDACTED_AWS_SECRET]\2'),
    
    # GitHub Personal Access Tokens and Fine-Grained Tokens
    (re.compile(r"\b(ghp_[A-Za-z0-9]{36,})\b"), r"[REDACTED_GITHUB_PAT]"),
    (re.compile(r"\b(github_pat_[A-Za-z0-9_]{50,})\b"), r"[REDACTED_GITHUB_FINE_GRAINED_TOKEN]"),
    
    # Generic Private Keys
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"), r"[REDACTED_PRIVATE_KEY]"),
    
    # Database Connection URIs with credentials
    (re.compile(r"(postgres(?:ql)?(?:\+[a-z0-9]+)?://)([^:@\s]+):([^@\s]+)@"), r"\1\2:[REDACTED_DB_PW]@"),
    (re.compile(r"(mysql(?:\+[a-z0-9]+)?://)([^:@\s]+):([^@\s]+)@"), r"\1\2:[REDACTED_DB_PW]@"),
    (re.compile(r"(mongodb(?:\+srv)?://)([^:@\s]+):([^@\s]+)@"), r"\1\2:[REDACTED_DB_PW]@"),
    (re.compile(r"(redis(?:s)?://)(:[^@\s]+)@"), r"\1:[REDACTED_REDIS_PW]@"),
    
    # JWT Tokens (three base64 segments)
    (re.compile(r"\beyJ[A-Za-z0-9\-_]{10,}\.eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\b"), r"[REDACTED_JWT_TOKEN]"),
]


def redact_secrets(text: str | None) -> str:
    """Mask credentials, passwords, tokens, and keys from text before feeding to AI models."""
    if not text:
        return ""
    
    redacted = str(text)
    for pattern, replacement in REDACTION_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def redact_dict(data: dict[str, Any] | list[Any] | Any) -> Any:
    """Recursively scrub sensitive keys and string values in dictionary payloads."""
    if isinstance(data, dict):
        clean_dict = {}
        for k, v in data.items():
            lower_k = str(k).lower()
            if any(s in lower_k for s in ("password", "secret", "token", "api_key", "authorization", "private_key")):
                clean_dict[k] = "[REDACTED_FIELD]"
            else:
                clean_dict[k] = redact_dict(v)
        return clean_dict
    elif isinstance(data, list):
        return [redact_dict(item) for item in data]
    elif isinstance(data, str):
        return redact_secrets(data)
    return data
