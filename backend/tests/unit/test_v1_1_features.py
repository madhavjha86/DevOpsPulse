"""Unit tests for DevOpsPulse v1.1 Four Major Features.

Covers:
1. Smart Incident Management (lifecycle, audit events, mttr, assignment)
2. AI Root Cause Analysis (evidence line extraction, confidence explanation, missing log detection)
3. Cloud Cost Intelligence (multi-provider breakdown, daily points, budgets, optimizations)
4. Engineering Team Productivity Analytics (team DORA, review latencies, PR sizes, non-ranking disclaimer)
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.incident import IncidentCreate, IncidentStatusUpdate, IncidentCommentCreate
from app.schemas.cloud_cost import BudgetCreate
from app.schemas.team_productivity import TeamCreate
from app.schemas.ai_copilot import GenerateRCARequest
from app.services.incident_service import IncidentService
from app.services.cloud_cost_service import CloudCostService
from app.services.team_productivity_service import TeamProductivityService
from app.services.ai_copilot_service import AICopilotService


@pytest.mark.asyncio
async def test_incident_lifecycle_and_audit(db_session: AsyncSession, test_user: User):
    """Test incident creation, transitions, comments, and stats."""
    # 1. Create incident
    payload = IncidentCreate(
        title="Production API 502 Outage",
        description="NGINX upstream pool connection timeouts on gateway pods",
        severity="CRITICAL",
        priority="P1",
        service="api-gateway",
        environment="production",
        send_email=False,
        send_slack=False,
    )
    inc = await IncidentService.create_incident(db_session, test_user.id, payload)
    assert inc.id is not None
    assert inc.status == "OPEN"
    assert inc.severity == "CRITICAL"

    # Fetch detail to verify timeline
    detail = await IncidentService.get_incident(db_session, test_user.id, inc.id)
    assert detail is not None
    assert len(detail.timeline_events) >= 1
    assert "Incident opened" in detail.timeline_events[0].message

    # 2. Acknowledge
    ack = await IncidentService.update_status(
        db_session,
        test_user.id,
        inc.id,
        IncidentStatusUpdate(status="ACKNOWLEDGED", comment="On-call engineer paged"),
    )
    assert ack is not None
    assert ack.status == "ACKNOWLEDGED"

    # 3. Add comment
    cmt_detail = await IncidentService.add_comment(
        db_session,
        test_user.id,
        inc.id,
        IncidentCommentCreate(message="Scaled upstream replica set to 8"),
    )
    assert cmt_detail is not None
    assert any("Scaled upstream replica set to 8" in ev.message for ev in cmt_detail.timeline_events)

    # 4. Resolve
    res = await IncidentService.update_status(
        db_session,
        test_user.id,
        inc.id,
        IncidentStatusUpdate(
            status="RESOLVED",
            resolution_notes="Increased pod memory limits and scaled out pool",
        ),
    )
    assert res is not None
    assert res.status == "RESOLVED"
    assert res.resolved_at is not None

    # 5. Check stats
    stats = await IncidentService.get_stats(db_session, test_user.id)
    assert stats.total_incidents >= 1
    assert stats.resolved_incidents >= 1
    assert stats.by_severity["CRITICAL"] >= 1


@pytest.mark.asyncio
async def test_ai_rca_evidence_and_confidence(db_session: AsyncSession, test_user: User):
    """Test AI Root Cause Analysis log parsing, evidence extraction, and missing log detection."""
    sample_log = """
    npm ERR! code ERESOLVE
    npm ERR! ERESOLVE unable to resolve dependency tree
    npm ERR! While resolving: devopspulse-frontend@1.0.0
    npm ERR! Found: react@18.2.0
    npm ERR! node_modules/react
    npm ERR!   peer react@"^18.0.0" from react-dom@18.2.0
    npm ERR! Conflicting peer dependency: typescript@5.0.0
    Process completed with exit code 1.
    """

    req = GenerateRCARequest(
        job_name="frontend-build",
        log_excerpt=sample_log,
    )
    result = await AICopilotService.generate_rca(db_session, test_user.id, payload=req)
    assert result.id is not None
    assert result.failure_category in [
        "DEPENDENCY_CONFLICT",
        "DEPENDENCY_ERROR",
        "BUILD_FAILURE",
        "SYSTEM_ERROR",
        "MODULE_NOT_FOUND",
    ]
    assert result.confidence_score >= 0.70
    assert len(result.confidence_explanation) > 0
    assert result.is_insufficient_data is False
    assert len(result.evidence_snippets) >= 1
    assert len(result.remediation_steps) >= 1


@pytest.mark.asyncio
async def test_ai_rca_insufficient_data_safety(db_session: AsyncSession, test_user: User):
    """Test that when logs are empty or missing, AI flags is_insufficient_data without hallucinating."""
    req = GenerateRCARequest(
        job_name="unknown-job",
        log_excerpt="",
    )
    result = await AICopilotService.generate_rca(db_session, test_user.id, payload=req)
    assert result.is_insufficient_data is True
    summary_lower = result.summary.lower()
    assert (
        "insufficient" in summary_lower
        or "unavailable" in summary_lower
        or "missing" in summary_lower
    )


@pytest.mark.asyncio
async def test_cloud_cost_intelligence(db_session: AsyncSession, test_user: User):
    """Test Cloud Cost overview, budgets, and optimization recommendations."""
    # 1. Overview
    overview = await CloudCostService.get_overview(db_session, test_user.id)
    assert overview.total_monthly_spend >= 0.0
    assert len(overview.providers) == 3
    assert any(p.provider == "AWS" for p in overview.providers)

    # 2. Create Budget
    budget_req = BudgetCreate(
        name="Production Infra",
        provider="ALL",
        monthly_budget=5000.0,
        warning_threshold=80.0,
        critical_threshold=100.0,
        alert_email="billing@example.com",
    )
    budget = await CloudCostService.create_budget(db_session, test_user.id, budget_req)
    assert budget.id is not None
    assert budget.monthly_budget == 5000.0
    assert budget.status in ["OK", "WARNING", "CRITICAL"]

    # 3. Optimizations
    opts = await CloudCostService.list_optimizations(db_session, test_user.id)
    assert len(opts) >= 1
    first_opt = opts[0]
    assert first_opt.estimated_monthly_savings > 0

    # 4. Apply optimization
    apply_res = await CloudCostService.apply_optimization(db_session, test_user.id, first_opt.id)
    assert apply_res is not None
    assert apply_res.status == "APPLIED"


@pytest.mark.asyncio
async def test_team_productivity_analytics(db_session: AsyncSession, test_user: User):
    """Test team productivity metrics and verify non-ranking compliance."""
    # 1. Create team
    team_req = TeamCreate(
        name="Platform Core Team",
        description="Core services and infrastructure platform engineering",
    )
    team = await TeamProductivityService.create_team(db_session, test_user.id, team_req)
    assert team.id is not None
    assert team.name == "Platform Core Team"

    # 2. Get overview
    overview = await TeamProductivityService.get_overview(db_session, test_user.id, team_id=team.id)
    assert overview.team_name == "Platform Core Team"
    assert overview.dora.deployment_frequency_rating in ["Elite", "High", "Medium", "Low"]
    assert len(overview.pr_size_distribution) == 3
    assert len(overview.collaboration_insights) >= 2

    # 3. Strict verification: ranking disclaimer is present and individual ranks are absent
    assert "individual developer ranking" in overview.ranking_disclaimer.lower()
    # Confirm no developer leaderboard attribute
    assert not hasattr(overview, "developer_rankings")
    assert not hasattr(overview, "individual_scores")
