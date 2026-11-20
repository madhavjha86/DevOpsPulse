"""Unit tests for Enterprise AI Governance, Token FinOps, and Cost Attribution."""

import pytest
from app.services.ai_governance_service import AIGovernanceService, MODEL_PRICING_PER_1M


def test_calculate_token_cost():
    """Verify exact USD calculation for prompt and completion tokens."""
    # Claude 3.5 Sonnet: $3.00 prompt, $15.00 completion per 1M tokens
    cost_claude = AIGovernanceService.calculate_cost("claude-3-5-sonnet", 1_000_000, 1_000_000)
    assert cost_claude == 18.00, f"Expected 18.00, got {cost_claude}"

    # GPT-4o: $2.50 prompt, $10.00 completion per 1M tokens
    cost_gpt4o = AIGovernanceService.calculate_cost("gpt-4o", 100_000, 20_000)
    # (100k / 1M) * 2.50 = 0.25; (20k / 1M) * 10 = 0.20 -> 0.45
    assert cost_gpt4o == 0.45, f"Expected 0.45, got {cost_gpt4o}"

    # Ollama / Local: $0.00
    cost_ollama = AIGovernanceService.calculate_cost("ollama/llama3", 500_000, 500_000)
    assert cost_ollama == 0.0, f"Expected 0.0, got {cost_ollama}"


@pytest.mark.asyncio
async def test_governance_summary_calculation(db_session, test_user):
    """Test recording usage and computing enterprise governance leaderboard."""
    from app.models.organization import Organization
    
    org = Organization(name="Test Corp", slug="test-corp-gov", owner_id=test_user.id)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # 1. Record usage for test_user with Claude Code
    await AIGovernanceService.record_usage(
        db=db_session,
        organization_id=org.id,
        user_id=test_user.id,
        tool_name="Claude Code",
        provider="anthropic",
        model_name="claude-3-5-sonnet",
        prompt_tokens=500_000,
        completion_tokens=100_000,
    )

    # 2. Record usage for test_user with Cursor IDE
    await AIGovernanceService.record_usage(
        db=db_session,
        organization_id=org.id,
        user_id=test_user.id,
        tool_name="Cursor IDE",
        provider="openai",
        model_name="gpt-4o",
        prompt_tokens=200_000,
        completion_tokens=50_000,
    )

    # 3. Fetch summary
    summary = await AIGovernanceService.get_governance_summary(
        db=db_session,
        organization_id=org.id,
        user_id=test_user.id,
        timeframe_days=30,
    )

    assert summary["summary"]["total_tokens"] >= 850_000
    assert summary["summary"]["total_cost_usd"] > 0
    assert len(summary["tool_breakdown"]) >= 2
    assert len(summary["employees"]) >= 1

    emp = summary["employees"][0]
    assert emp["email"] == test_user.email
    assert emp["total_tokens"] >= 850_000
    assert emp["monthly_cost_limit"] > 0
