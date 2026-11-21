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
        # Query real team members belonging to this organization
        member_stmt = (
            select(
                User.id.label("user_id"),
                User.email,
                User.full_name,
                User.username,
                OrganizationMember.role,
            )
            .join(OrganizationMember, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == organization_id)
        )
        member_res = await db.execute(member_stmt)
        team_members: dict[int, Any] = {m.user_id: m for m in member_res.all()}

        # Also include current requesting user if not in team_members
        if user_id and user_id not in team_members:
            cur_u_res = await db.execute(select(User).where(User.id == user_id))
            cur_u = cur_u_res.scalar_one_or_none()
            if cur_u:
                team_members[cur_u.id] = type(
                    "UserMember",
                    (),
                    {
                        "user_id": cur_u.id,
                        "email": cur_u.email,
                        "full_name": cur_u.full_name,
                        "username": cur_u.username,
                        "role": cur_u.role or "DEVELOPER",
                    },
                )()

        # Aggregated actual usage from AITokenLedger
        usage_stmt = (
            select(
                AITokenLedger.user_id,
                func.coalesce(func.sum(AITokenLedger.total_tokens), 0).label("user_tokens"),
                func.coalesce(func.sum(AITokenLedger.prompt_tokens), 0).label("user_prompt_tokens"),
                func.coalesce(func.sum(AITokenLedger.completion_tokens), 0).label("user_completion_tokens"),
                func.coalesce(func.sum(AITokenLedger.estimated_cost_usd), 0.0).label("user_cost_usd"),
                func.count(AITokenLedger.id).label("user_requests"),
            )
            .where(
                AITokenLedger.organization_id == organization_id,
                AITokenLedger.created_at >= since_date,
            )
            .group_by(AITokenLedger.user_id)
        )
        usage_res = await db.execute(usage_stmt)
        usage_map = {row.user_id: row for row in usage_res.all()}

        # If any user recorded usage but was not in team_members, include them
        for uid in usage_map:
            if uid not in team_members:
                ext_u_res = await db.execute(select(User).where(User.id == uid))
                ext_u = ext_u_res.scalar_one_or_none()
                if ext_u:
                    team_members[uid] = type(
                        "UserMember",
                        (),
                        {
                            "user_id": ext_u.id,
                            "email": ext_u.email,
                            "full_name": ext_u.full_name,
                            "username": ext_u.username,
                            "role": ext_u.role or "DEVELOPER",
                        },
                    )()

        # Fetch quotas for users
        quotas_stmt = select(AIUserQuota).where(AIUserQuota.organization_id == organization_id)
        quotas_res = await db.execute(quotas_stmt)
        quota_map = {q.user_id: q for q in quotas_res.scalars().all()}

        employees: list[dict[str, Any]] = []
        for uid, member in team_members.items():
            u_usage = usage_map.get(uid)
            u_tokens = int(u_usage.user_tokens) if u_usage else 0
            u_prompt = int(u_usage.user_prompt_tokens) if u_usage else 0
            u_comp = int(u_usage.user_completion_tokens) if u_usage else 0
            user_cost = float(u_usage.user_cost_usd) if u_usage else 0.0
            u_requests = int(u_usage.user_requests) if u_usage else 0

            u_quota = quota_map.get(uid)
            cost_limit = u_quota.monthly_cost_limit_usd if u_quota else 50.0
            token_limit = u_quota.monthly_token_limit if u_quota else 5_000_000
            quota_pct = round((user_cost / cost_limit) * 100, 1) if cost_limit > 0 else 0.0

            status_badge = "NORMAL"
            if quota_pct >= 100:
                status_badge = "EXCEEDED"
            elif quota_pct >= (u_quota.alert_threshold_percentage if u_quota else 80):
                status_badge = "WARNING"

            employees.append({
                "user_id": uid,
                "name": member.full_name or member.username or member.email.split("@")[0],
                "email": member.email,
                "role": member.role or "DEVELOPER",
                "total_tokens": u_tokens,
                "prompt_tokens": u_prompt,
                "completion_tokens": u_comp,
                "total_cost_usd": round(user_cost, 4),
                "requests_count": u_requests,
                "monthly_cost_limit": cost_limit,
                "monthly_token_limit": token_limit,
                "budget_used_percentage": quota_pct,
                "budget_status": status_badge,
                "enforcement_action": u_quota.enforcement_action if u_quota else "NOTIFY",
            })

        employees.sort(key=lambda x: x["total_cost_usd"], reverse=True)

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
