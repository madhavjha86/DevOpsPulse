"""Zero-Trust Secrets Vault and Environment Sync Schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class SecretItem(BaseModel):
    """An encrypted application secret managed across environments."""

    id: str
    key: str
    value_masked: str
    environment: Literal["development", "staging", "production"]
    category: Literal["API_KEY", "DATABASE_URL", "SSH_KEY", "CERTIFICATE", "OAUTH_TOKEN"]
    version: int = 1
    is_leaked: bool = False
    last_rotated_at: datetime
    created_at: datetime


class SecretCreateRequest(BaseModel):
    """Payload to store a new zero-trust encrypted secret."""

    key: str = Field(..., min_length=2, max_length=120, pattern=r"^[A-Z0-9_]+$")
    value: str = Field(..., min_length=1, max_length=4000)
    environment: Literal["development", "staging", "production"] = "production"
    category: Literal["API_KEY", "DATABASE_URL", "SSH_KEY", "CERTIFICATE", "OAUTH_TOKEN"] = "API_KEY"


class SecretRevealResponse(BaseModel):
    """Unmasked secret value returned only on authorized demand."""

    key: str
    value: str
    environment: str


class SecretLeakFinding(BaseModel):
    """A detected plaintext secret or token found in git/docker/config."""

    file_path: str
    line_number: int
    secret_type: str
    snippet_masked: str
    severity: Literal["high", "critical"]


class SecretLeakScanResult(BaseModel):
    """Summary of zero-trust leak scanner."""

    scanned_files_count: int
    detected_leaks_count: int
    findings: list[SecretLeakFinding]
    scanned_at: datetime


class SecretSyncK8sRequest(BaseModel):
    """Request to inject environment vault secrets into a Kubernetes Secret object."""

    environment: Literal["development", "staging", "production"] = "production"
    namespace: str = "production"
    secret_name: str = "app-secrets-vault"


class SecretSyncK8sResponse(BaseModel):
    """Result of Kubernetes Secret injection."""

    status: str
    injected_keys_count: int
    k8s_secret_name: str
    namespace: str
    duration_ms: float
