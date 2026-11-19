"""Disaster Recovery, Automated Backup Snapshots, and Scoped API Keys schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class BackupCreateRequest(BaseModel):
    """Payload to trigger an on-demand database backup snapshot."""

    backup_name: str = Field(..., max_length=150)
    target_database: str = Field(default="devopspulse-production-db", max_length=100)
    backup_type: str = Field(default="FULL_SNAPSHOT", max_length=50)


class BackupRecordResponse(BaseModel):
    """Backup snapshot metadata and integrity verification."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    backup_name: str
    backup_type: str
    target_database: str
    storage_location: str
    size_bytes: int
    status: str
    checksum_sha256: str
    completed_at: datetime | None = None
    created_at: datetime


class DrillRunRequest(BaseModel):
    """Payload to execute an actual Disaster Recovery failover drill."""

    drill_name: str = Field(default="Live Point-in-Time Recovery Certification Drill", max_length=150)
    target_system: str = Field(default="PostgreSQL Primary Cluster", max_length=100)


class DrillResponse(BaseModel):
    """Disaster recovery drill result with RPO and RTO metrics."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    drill_name: str
    target_system: str
    status: str
    rpo_target_minutes: float
    rpo_actual_minutes: float
    rto_target_minutes: float
    rto_actual_minutes: float
    data_loss_bytes: int
    backup_snapshot_id: str
    verification_notes: str
    tested_by: str
    executed_at: datetime


class DisasterRecoveryOverviewResponse(BaseModel):
    """Executive Disaster Recovery readiness scorecard and audit trail."""

    target_rpo_minutes: float
    actual_rpo_minutes: float
    target_rto_minutes: float
    actual_rto_minutes: float
    readiness_score: int
    readiness_grade: str
    last_drill_at: datetime | None = None
    total_backups_count: int
    latest_backup_completed: bool
    drills: list[DrillResponse]
    backups: list[BackupRecordResponse]


class ApiKeyCreateRequest(BaseModel):
    """Payload to generate a new scoped organization API key."""

    name: str = Field(..., max_length=100)
    scopes: str = Field(default="read:telemetry,write:iac,read:security", max_length=255)
    expires_in_days: int = Field(default=90, ge=1, le=365)


class ApiKeyCreatedResponse(BaseModel):
    """One-time display response containing raw API key token."""

    id: int
    name: str
    key_prefix: str
    scopes: str
    raw_key: str
    expires_at: datetime | None = None
    created_at: datetime


class ApiKeyResponse(BaseModel):
    """Masked representation of an organization API key."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key_prefix: str
    scopes: str
    is_active: bool
    expires_at: datetime | None = None
    last_used_at: datetime | None = None
    last_used_ip: str | None = None
    created_at: datetime
