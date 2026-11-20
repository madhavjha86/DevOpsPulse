"""Enterprise AI Governance, Token FinOps, and Employee Attribution ORM Models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class AITokenLedger(Base, TimestampMixin):
    """Immutable ledger recording every AI interaction, token consumption, and cost attribution."""

    __tablename__ = "ai_token_ledgers"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Tool & Model Origin
    tool_name: Mapped[str] = mapped_column(
        String(100), default="DevOpsPulse Copilot", nullable=False, index=True
    )  # e.g., "Claude Code", "GitHub Copilot", "Cursor IDE", "OpenAI Codex", "DevOpsPulse Copilot"
    provider: Mapped[str] = mapped_column(
        String(50), default="openai", nullable=False, index=True
    )  # anthropic, openai, groq, gemini, ollama
    model_name: Mapped[str] = mapped_column(
        String(100), default="gpt-4o", nullable=False, index=True
    )

    # Token Accounting
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Latency & Telemetry
    request_latency_ms: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="SUCCESS", nullable=False
    )  # SUCCESS, RATE_LIMITED, BUDGET_EXCEEDED, FAILED
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User")
    organization: Mapped["Organization"] = relationship("Organization")

    __table_args__ = (
        Index("ix_ai_ledger_org_user", "organization_id", "user_id"),
        Index("ix_ai_ledger_org_created", "organization_id", "created_at"),
        Index("ix_ai_ledger_tool_model", "tool_name", "model_name"),
    )


class AIUserQuota(Base, TimestampMixin):
    """Monthly budget, token ceiling, and guardrails allocated to an employee / developer."""

    __tablename__ = "ai_user_quotas"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Budgets
    monthly_token_limit: Mapped[int] = mapped_column(Integer, default=5000000, nullable=False)  # 5 Million tokens
    monthly_cost_limit_usd: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)  # $50.00
    alert_threshold_percentage: Mapped[int] = mapped_column(Integer, default=80, nullable=False)  # 80% warning

    # Policy
    enforcement_action: Mapped[str] = mapped_column(
        String(50), default="NOTIFY", nullable=False
    )  # NOTIFY (soft limit), BLOCK (hard limit)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
    organization: Mapped["Organization"] = relationship("Organization")

    __table_args__ = (
        Index("ix_ai_quota_unique", "organization_id", "user_id", unique=True),
    )
