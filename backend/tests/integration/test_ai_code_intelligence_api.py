"""Integration tests for AI Pull Request Reviewer and CI/CD Failure Prediction API."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestAICodeIntelligenceAPI:
    """Validate PR code review static/AI scanning and predictive failure risk scoring."""

    @pytest.mark.asyncio
    async def test_unauthorized_reviews_access(self, client: AsyncClient) -> None:
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        res = await client.get("/api/v1/ai/intelligence/reviews")
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_list_reviews_auto_seeds_demo(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """First fetch auto-seeds a sample PR review."""
        client, user = authenticated_client
        res = await client.get("/api/v1/ai/intelligence/reviews")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["security_score"] >= 80

    @pytest.mark.asyncio
    async def test_generate_pr_review_with_security_violations(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Diff with secret leak must trigger REQUEST_CHANGES verdict and security findings."""
        client, user = authenticated_client

        diff = (
            "--- a/app/core/auth.py\n"
            "+++ b/app/core/auth.py\n"
            "@@ -10,3 +10,4 @@\n"
            "+STRIPE_API_KEY = 'sk_live_991824719284719284'\n"
            "+def process():\n"
            "+    pass\n"
        )
        payload = {
            "pr_number": 105,
            "pr_title": "feat: Stripe webhook integration",
            "diff_content": diff,
        }
        res = await client.post("/api/v1/ai/intelligence/reviews/generate", json=payload)
        assert res.status_code == 201
        review = res.json()
        assert review["pr_number"] == 105
        assert review["review_verdict"] == "REQUEST_CHANGES"
        assert review["security_score"] <= 60
        assert len(review["findings"]) >= 1
        assert any(f["category"] == "SECURITY" for f in review["findings"])

    @pytest.mark.asyncio
    async def test_predict_failure_high_risk(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        """Commits modifying migrations and auth without tests must trigger elevated risk score."""
        client, user = authenticated_client

        payload = {
            "commit_sha": "d4e21a889",
            "branch": "main",
            "changed_files": [
                "backend/alembic/versions/009_core_schema.py",
                "backend/app/core/auth.py",
                "backend/app/services/auth_service.py",
            ],
            "additions": 620,
            "deletions": 140,
        }
        res = await client.post("/api/v1/ai/intelligence/predictions/evaluate", json=payload)
        assert res.status_code == 201
        pred = res.json()
        assert pred["commit_sha"] == "d4e21a889"
        assert pred["risk_score"] >= 0.50
        assert pred["risk_level"] in ("HIGH", "CRITICAL")
        assert len(pred["risk_factors"]) >= 2
        assert len(pred["recommendations"]) >= 1

        # Query predictions list
        list_res = await client.get("/api/v1/ai/intelligence/predictions")
        assert list_res.status_code == 200
        preds = list_res.json()
        assert any(p["commit_sha"] == "d4e21a889" for p in preds)
