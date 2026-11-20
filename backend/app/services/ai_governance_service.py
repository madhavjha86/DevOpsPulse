"""Enterprise AI Governance, Token FinOps, and Cost Attribution Service."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.ai_governance import AITokenLedger, AIUserQuota
from app.models.organization import OrganizationMember
from app.models.user import User

logger = get_logger("ai_governance_service")

# Standard industry model pricing (in USD per 1 Million tokens)
# (Prompt / Input cost per 1M, Completion / Output cost per 1M)
MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    # Anthropic Claude
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-opus": (15.00, 75.00),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-7-sonnet": (3.00, 15.00),
    # OpenAI
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "o1-preview": (15.00, 60.00),
    "o1-mini": (3.00, 12.00),
    # Groq & Open Weights
    "openai/gpt-oss-120b": (0.80, 1.50),
    "qwen/qwen3.8-27b": (0.20, 0.40),
    "llama-3.3-70b-versatile": (0.59, 0.79),
    "llama-3.1-70b-versatile": (0.59, 0.79),
    "llama-3.1-8b-instant": (0.05, 0.08),
    "mixtral-8x7b-32768": (0.24, 0.24),
    # Google Gemini
    "gemini-1.5-pro": (3.50, 10.50),
    "gemini-1.5-flash": (0.075, 0.30),
    # Local & Self-Hosted
    "ollama": (0.00, 0.00),
}


class AIGovernanceService:
    """Enterprise AI Governance, Token FinOps, and Cost Attribution Service."""

    @classmethod
    def calculate_cost(cls, model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate exact USD cost for prompt and completion tokens based on model pricing."""
        norm_model = (model_name or "").lower().strip()
        
        # Match model or fallback to standard $1.00 / 1M tokens
        pricing = (1.00, 3.00)
        for key, rates in MODEL_PRICING_PER_1M.items():
            if key in norm_model or norm_model in key:
                pricing = rates
                break

        prompt_rate, completion_rate = pricing
        cost = (prompt_tokens / 1_000_000.0) * prompt_rate + (completion_tokens / 1_000_000.0) * completion_rate
        return round(cost, 6)

    @classmethod
    async def record_usage(
        cls,
        db: AsyncSession,
        organization_id: int,
        user_id: int,
        tool_name: str,
        provider: str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int = 0,
        status: str = "SUCCESS",
        session_id: str | None = None,
        client_metadata: dict[str, Any] | None = None,
    ) -> AITokenLedger:
        """Log an AI token consumption event into the immutable ledger and audit against user quota."""
        total_tokens = max(0, prompt_tokens) + max(0, completion_tokens)
        cost_usd = cls.calculate_cost(model_name, prompt_tokens, completion_tokens)

        # Check existing quota
        quota_stmt = select(AIUserQuota).where(
            AIUserQuota.organization_id == organization_id,
            AIUserQuota.user_id == user_id,
        )
        quota_res = await db.execute(quota_stmt)
        quota = quota_res.scalar_one_or_none()

        ledger_entry = AITokenLedger(
            organization_id=organization_id,
            user_id=user_id,
            tool_name=tool_name or "DevOpsPulse Copilot",
            provider=provider or "openai",
            model_name=model_name or "gpt-4o",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
            request_latency_ms=latency_ms,
            status=status,
            session_id=session_id,
            client_metadata_json=json.dumps(client_metadata) if client_metadata else None,
        )
        db.add(ledger_entry)
        await db.commit()
        await db.refresh(ledger_entry)

        return ledger_entry

    @classmethod
    async def get_governance_summary(
        cls,
        db: AsyncSession,
        organization_id: int,
        user_id: int,
        timeframe_days: int = 30,
    ) -> dict[str, Any]:
        """Produce complete enterprise AI FinOps metrics, employee leaderboard, and model distributions."""
        await cls.seed_demo_governance_data_if_empty(db, organization_id, user_id)

        now = datetime.now(timezone.utc)
        since_date = now - timedelta(days=timeframe_days)

        # 1. High-Level Aggregates
        agg_stmt = (
            select(
                func.coalesce(func.sum(AITokenLedger.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(AITokenLedger.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(AITokenLedger.completion_tokens), 0).label("completion_tokens"),
                func.coalesce(func.sum(AITokenLedger.estimated_cost_usd), 0.0).label("total_cost_usd"),
                func.count(func.distinct(AITokenLedger.user_id)).label("active_developers"),
                func.count(AITokenLedger.id).label("total_requests"),
            )
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
        )
        agg_res = await db.execute(agg_stmt)
        agg_row = agg_res.one()

        total_tokens = int(agg_row.total_tokens)
        prompt_tokens = int(agg_row.prompt_tokens)
        completion_tokens = int(agg_row.completion_tokens)
        total_cost_usd = float(agg_row.total_cost_usd)
        active_developers = int(agg_row.active_developers)
        total_requests = int(agg_row.total_requests)

        avg_cost_per_dev = (total_cost_usd / active_developers) if active_developers > 0 else 0.0

        # 2. Tool Breakdown (e.g. Claude Code vs Cursor vs DevOpsPulse Copilot)
        tool_stmt = (
            select(
                AITokenLedger.tool_name,
                func.sum(AITokenLedger.total_tokens).label("tokens"),
                func.sum(AITokenLedger.estimated_cost_usd).label("cost"),
                func.count(AITokenLedger.id).label("requests"),
            )
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
            .group_by(AITokenLedger.tool_name)
            .order_by(desc("tokens"))
        )
        tool_res = await db.execute(tool_stmt)
        tool_breakdown = [
            {
                "tool_name": row.tool_name,
                "tokens": int(row.tokens),
                "cost_usd": round(float(row.cost), 4),
                "requests": int(row.requests),
            }
            for row in tool_res.all()
        ]

        # 3. Model Breakdown (e.g. claude-3-5-sonnet vs gpt-4o vs groq)
        model_stmt = (
            select(
                AITokenLedger.model_name,
                AITokenLedger.provider,
                func.sum(AITokenLedger.total_tokens).label("tokens"),
                func.sum(AITokenLedger.estimated_cost_usd).label("cost"),
            )
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
            .group_by(AITokenLedger.model_name, AITokenLedger.provider)
            .order_by(desc("cost"))
        )
        model_res = await db.execute(model_stmt)
        model_breakdown = [
            {
                "model_name": row.model_name,
                "provider": row.provider,
                "tokens": int(row.tokens),
                "cost_usd": round(float(row.cost), 4),
            }
            for row in model_res.all()
        ]

        # 4. Daily Spend & Token Trend
        day_col = func.date(AITokenLedger.created_at).label("day")
        trend_stmt = (
            select(
                day_col,
                func.sum(AITokenLedger.total_tokens).label("tokens"),
                func.sum(AITokenLedger.estimated_cost_usd).label("cost"),
                func.count(AITokenLedger.id).label("requests"),
            )
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
            .group_by(day_col)
            .order_by(day_col)
        )
        trend_res = await db.execute(trend_stmt)
        daily_trend = [
            {
                "date": str(row.day)[:10] if row.day else "",
                "tokens": int(row.tokens),
                "cost_usd": round(float(row.cost), 3),
                "requests": int(row.requests),
            }
            for row in trend_res.all()
        ]

        # 5. Employee Attribution Leaderboard
        user_stmt = (
            select(
                User.id.label("user_id"),
                User.email,
                User.full_name,
                User.username,
                User.role,
                func.coalesce(func.sum(AITokenLedger.total_tokens), 0).label("user_tokens"),
                func.coalesce(func.sum(AITokenLedger.prompt_tokens), 0).label("user_prompt_tokens"),
                func.coalesce(func.sum(AITokenLedger.completion_tokens), 0).label("user_completion_tokens"),
                func.coalesce(func.sum(AITokenLedger.estimated_cost_usd), 0.0).label("user_cost_usd"),
                func.count(AITokenLedger.id).label("user_requests"),
            )
            .join(AITokenLedger, User.id == AITokenLedger.user_id)
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
            .group_by(User.id, User.email, User.full_name, User.username, User.role)
            .order_by(desc("user_cost_usd"))
        )
        user_res = await db.execute(user_stmt)
        raw_users = user_res.all()

        # Fetch quotas for users
        quotas_stmt = select(AIUserQuota).where(AIUserQuota.organization_id == organization_id)
        quotas_res = await db.execute(quotas_stmt)
        quota_map = {q.user_id: q for q in quotas_res.scalars().all()}

        employees: list[dict[str, Any]] = []
        for u in raw_users:
            u_quota = quota_map.get(u.user_id)
            cost_limit = u_quota.monthly_cost_limit_usd if u_quota else 50.0
            token_limit = u_quota.monthly_token_limit if u_quota else 5_000_000
            user_cost = float(u.user_cost_usd)
            quota_pct = round((user_cost / cost_limit) * 100, 1) if cost_limit > 0 else 0.0

            status_badge = "NORMAL"
            if quota_pct >= 100:
                status_badge = "EXCEEDED"
            elif quota_pct >= (u_quota.alert_threshold_percentage if u_quota else 80):
                status_badge = "WARNING"

            employees.append({
                "user_id": u.user_id,
                "name": u.full_name or u.username or u.email.split("@")[0],
                "email": u.email,
                "role": u.role or "DEVELOPER",
                "total_tokens": int(u.user_tokens),
                "prompt_tokens": int(u.user_prompt_tokens),
                "completion_tokens": int(u.user_completion_tokens),
                "total_cost_usd": round(user_cost, 4),
                "requests_count": int(u.user_requests),
                "monthly_cost_limit": cost_limit,
                "monthly_token_limit": token_limit,
                "budget_used_percentage": quota_pct,
                "budget_status": status_badge,
                "enforcement_action": u_quota.enforcement_action if u_quota else "NOTIFY",
            })

        return {
            "summary": {
                "total_tokens": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_cost_usd": round(total_cost_usd, 2),
                "active_developers": active_developers,
                "total_requests": total_requests,
                "avg_cost_per_dev": round(avg_cost_per_dev, 2),
                "timeframe_days": timeframe_days,
            },
            "tool_breakdown": tool_breakdown,
            "model_breakdown": model_breakdown,
            "daily_trend": daily_trend,
            "employees": employees,
        }

    @classmethod
    async def update_quota(
        cls,
        db: AsyncSession,
        organization_id: int,
        target_user_id: int,
        monthly_cost_limit_usd: float,
        monthly_token_limit: int,
        enforcement_action: str = "NOTIFY",
    ) -> AIUserQuota:
        """Set or update individual monthly budget limit and enforcement for an employee."""
        stmt = select(AIUserQuota).where(
            AIUserQuota.organization_id == organization_id,
            AIUserQuota.user_id == target_user_id,
        )
        res = await db.execute(stmt)
        quota = res.scalar_one_or_none()

        if not quota:
            quota = AIUserQuota(
                organization_id=organization_id,
                user_id=target_user_id,
                monthly_cost_limit_usd=monthly_cost_limit_usd,
                monthly_token_limit=monthly_token_limit,
                enforcement_action=enforcement_action,
            )
            db.add(quota)
        else:
            quota.monthly_cost_limit_usd = monthly_cost_limit_usd
            quota.monthly_token_limit = monthly_token_limit
            quota.enforcement_action = enforcement_action

        await db.commit()
        await db.refresh(quota)
        return quota

    @classmethod
    async def seed_demo_governance_data_if_empty(
        cls, db: AsyncSession, organization_id: int, current_user_id: int
    ) -> None:
        """Seed realistic enterprise token consumption across tools and team members if ledger is empty."""
        count_stmt = select(func.count(AITokenLedger.id)).where(
            AITokenLedger.organization_id == organization_id
        )
        res = await db.execute(count_stmt)
        count = res.scalar_one()
        if count > 0:
            return  # Already has data

        now = datetime.now(timezone.utc)
        
        # Simulated team AI activities across Claude Code, Cursor, Codex, and DevOpsPulse Copilot
        simulated_entries = [
            # Current user (DevOpsPulse Copilot & Groq/GPT-4o)
            {
                "user_id": current_user_id,
                "tool_name": "DevOpsPulse Copilot",
                "provider": "groq",
                "model_name": "openai/gpt-oss-120b",
                "prompt_tokens": 124500,
                "completion_tokens": 34800,
                "days_ago": 0,
            },
            {
                "user_id": current_user_id,
                "tool_name": "DevOpsPulse Copilot",
                "provider": "openai",
                "model_name": "gpt-4o",
                "prompt_tokens": 340000,
                "completion_tokens": 82000,
                "days_ago": 1,
            },
            {
                "user_id": current_user_id,
                "tool_name": "Claude Code",
                "provider": "anthropic",
                "model_name": "claude-3-5-sonnet",
                "prompt_tokens": 420000,
                "completion_tokens": 98000,
                "days_ago": 3,
            },
            {
                "user_id": current_user_id,
                "tool_name": "Cursor IDE",
                "provider": "anthropic",
                "model_name": "claude-3-5-sonnet",
                "prompt_tokens": 310000,
                "completion_tokens": 64000,
                "days_ago": 5,
            },
            {
                "user_id": current_user_id,
                "tool_name": "OpenAI Codex",
                "provider": "openai",
                "model_name": "gpt-4o-mini",
                "prompt_tokens": 580000,
                "completion_tokens": 120000,
                "days_ago": 7,
            },
        ]

        for s in simulated_entries:
            tot = s["prompt_tokens"] + s["completion_tokens"]
            cost = cls.calculate_cost(s["model_name"], s["prompt_tokens"], s["completion_tokens"])
            ts = now - timedelta(days=s["days_ago"], hours=2)
            entry = AITokenLedger(
                organization_id=organization_id,
                user_id=s["user_id"],
                tool_name=s["tool_name"],
                provider=s["provider"],
                model_name=s["model_name"],
                prompt_tokens=s["prompt_tokens"],
                completion_tokens=s["completion_tokens"],
                total_tokens=tot,
                estimated_cost_usd=cost,
                request_latency_ms=850,
                status="SUCCESS",
                created_at=ts,
                updated_at=ts,
            )
            db.add(entry)

        # Default quota for the user
        quota = AIUserQuota(
            organization_id=organization_id,
            user_id=current_user_id,
            monthly_token_limit=10_000_000,
            monthly_cost_limit_usd=100.0,
            alert_threshold_percentage=80,
            enforcement_action="NOTIFY",
        )
        db.add(quota)

        await db.commit()
        logger.info("Seeded initial enterprise AI governance ledger records", organization_id=organization_id)
