"""Unit tests for Enterprise AI Governance, Token FinOps, and Cost Attribution."""

import pytest
from app.services.ai_governance_service import AIGovernanceService, MODEL_PRICING_PER_1M
from app.models.ai_governance import AITokenLedger, AIUserQuota
from app.schemas.ai_governance import (
    AITokenIngestRequest,
    AIUserQuotaUpdateRequest,
    AIGovernanceSummaryResponse,
)


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

    # Default fallback
    cost_fallback = AIGovernanceService.calculate_cost("unknown-model", 1_000_000, 1_000_000)
    assert cost_fallback > 0.0


def test_model_pricing_dict_completeness():
    """Verify all tier 1 models have prompt and completion pricing."""
    for model, pricing in MODEL_PRICING_PER_1M.items():
        assert isinstance(pricing, tuple)
        assert len(pricing) == 2
        prompt_cost, completion_cost = pricing
        assert prompt_cost >= 0.0
        assert completion_cost >= 0.0


def test_ai_token_ledger_model():
    """Verify ORM model attributes and defaults."""
    ledger = AITokenLedger(
        organization_id=1,
        user_id=2,
        tool_name="Claude Code",
        provider="anthropic",
        model_name="claude-3-5-sonnet",
        prompt_tokens=1000,
        completion_tokens=500,
        total_tokens=1500,
        estimated_cost_usd=0.0105,
        status="SUCCESS",
    )
    assert ledger.tool_name == "Claude Code"
    assert ledger.total_tokens == 1500
    assert ledger.status == "SUCCESS"


def test_ai_user_quota_model():
    """Verify Quota model fields."""
    quota = AIUserQuota(
        organization_id=1,
        user_id=2,
        monthly_cost_limit_usd=100.0,
        monthly_token_limit=10_000_000,
        alert_threshold_percentage=80,
        enforcement_action="NOTIFY",
    )
    assert quota.monthly_cost_limit_usd == 100.0
    assert quota.alert_threshold_percentage == 80


def test_governance_schemas():
    """Verify Pydantic request and response schemas."""
    usage_req = AITokenIngestRequest(
        tool_name="Cursor",
        provider="openai",
        model_name="gpt-4o",
        prompt_tokens=500,
        completion_tokens=100,
    )
    assert usage_req.tool_name == "Cursor"

    quota_update = AIUserQuotaUpdateRequest(
        monthly_cost_limit_usd=75.0,
        monthly_token_limit=5_000_000,
        enforcement_action="NOTIFY",
    )
    assert quota_update.monthly_cost_limit_usd == 75.0
    assert quota_update.monthly_token_limit == 5_000_000
