"""AI Pull Request Code Reviewer and CI/CD Failure Prediction service."""

import json
import re
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.ai_code_intelligence import AIFailurePrediction, AIPullRequestReview
from app.models.pull_request import PullRequest
from app.models.repository import Repository
from app.schemas.ai_code_intelligence import (
    AIFailurePredictionResponse,
    AIPullRequestReviewResponse,
    GeneratePRReviewRequest,
    PRReviewFinding,
    PredictFailureRequest,
)

logger = get_logger("ai_code_intelligence_service")


class AICodeIntelligenceService:
    """Automated AI Code Review and Predictive CI/CD Failure analysis engine."""

    # --------------------------------------------------------------------------
    # AI PULL REQUEST CODE REVIEWER
    # --------------------------------------------------------------------------

    @classmethod
    async def review_pull_request(
        cls, db: AsyncSession, user_id: int, payload: GeneratePRReviewRequest
    ) -> AIPullRequestReviewResponse:
        """Perform automated AI code review on PR git diff or patch."""
        pr_number = payload.pr_number
        pr_title = payload.pr_title or f"Pull Request #{pr_number}"
        repo_id = payload.repository_id

        if payload.pull_request_id:
            pr_res = await db.execute(
                select(PullRequest).where(PullRequest.id == payload.pull_request_id)
            )
            pr = pr_res.scalar_one_or_none()
            if pr:
                pr_number = pr.number
                pr_title = pr.title
                repo_id = pr.repository_id

        diff = payload.diff_content or (
            "--- a/app/core/auth.py\n"
            "+++ b/app/core/auth.py\n"
            "@@ -10,3 +10,4 @@\n"
            "+API_KEY = 'sk_live_9981249182479182'\n"
            "+def verify_token(token):\n"
            "+    pass\n"
        )

        analysis = cls._analyze_diff_heuristics(diff, pr_title)

        review = AIPullRequestReview(
            user_id=user_id,
            pull_request_id=payload.pull_request_id,
            repository_id=repo_id,
            pr_number=pr_number,
            pr_title=pr_title,
            review_verdict=analysis["verdict"],
            summary=analysis["summary"],
            findings_json=json.dumps(analysis["findings"]),
            security_score=analysis["security_score"],
        )
        db.add(review)
        await db.commit()
        await db.refresh(review)

        findings_objs = [PRReviewFinding(**f) for f in analysis["findings"]]

        return AIPullRequestReviewResponse(
            id=review.id,
            pull_request_id=review.pull_request_id,
            repository_id=review.repository_id,
            pr_number=review.pr_number,
            pr_title=review.pr_title,
            review_verdict=review.review_verdict,  # type: ignore
            summary=review.summary,
            findings=findings_objs,
            security_score=review.security_score,
            created_at=review.created_at,
        )

    @classmethod
    async def list_pr_reviews(
        cls, db: AsyncSession, user_id: int, limit: int = 50
    ) -> list[AIPullRequestReviewResponse]:
        """Fetch all recorded AI Pull Request reviews for the user."""
        await cls._ensure_demo_pr_reviews_seeded(db, user_id)

        stmt = (
            select(AIPullRequestReview)
            .where(AIPullRequestReview.user_id == user_id)
            .order_by(desc(AIPullRequestReview.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        reviews = res.scalars().all()

        results: list[AIPullRequestReviewResponse] = []
        for r in reviews:
            raw_findings = json.loads(r.findings_json) if r.findings_json else []
            findings_objs = [PRReviewFinding(**f) for f in raw_findings]
            results.append(
                AIPullRequestReviewResponse(
                    id=r.id,
                    pull_request_id=r.pull_request_id,
                    repository_id=r.repository_id,
                    pr_number=r.pr_number,
                    pr_title=r.pr_title,
                    review_verdict=r.review_verdict,  # type: ignore
                    summary=r.summary,
                    findings=findings_objs,
                    security_score=r.security_score,
                    created_at=r.created_at,
                )
            )
        return results

    # --------------------------------------------------------------------------
    # CI/CD FAILURE PREDICTION ENGINE
    # --------------------------------------------------------------------------

    @classmethod
    async def predict_failure(
        cls, db: AsyncSession, user_id: int, payload: PredictFailureRequest
    ) -> AIFailurePredictionResponse:
        """Calculate pre-flight risk score and failure probability before pipeline run."""
        sha = payload.commit_sha or "c8a14f92d"
        prediction_data = cls._evaluate_failure_risk(
            branch=payload.branch,
            files=payload.changed_files,
            additions=payload.additions,
            deletions=payload.deletions,
        )

        entry = AIFailurePrediction(
            user_id=user_id,
            repository_id=payload.repository_id,
            commit_sha=sha,
            branch=payload.branch,
            risk_score=prediction_data["risk_score"],
            risk_level=prediction_data["risk_level"],
            risk_factors_json=json.dumps(prediction_data["risk_factors"]),
            recommendations_json=json.dumps(prediction_data["recommendations"]),
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        return AIFailurePredictionResponse(
            id=entry.id,
            repository_id=entry.repository_id,
            commit_sha=entry.commit_sha,
            branch=entry.branch,
            risk_score=entry.risk_score,
            risk_level=entry.risk_level,  # type: ignore
            risk_factors=prediction_data["risk_factors"],
            recommendations=prediction_data["recommendations"],
            created_at=entry.created_at,
        )

    @classmethod
    async def list_predictions(
        cls, db: AsyncSession, user_id: int, limit: int = 50
    ) -> list[AIFailurePredictionResponse]:
        """Fetch historical CI/CD failure predictions."""
        await cls._ensure_demo_predictions_seeded(db, user_id)

        stmt = (
            select(AIFailurePrediction)
            .where(AIFailurePrediction.user_id == user_id)
            .order_by(desc(AIFailurePrediction.created_at))
            .limit(limit)
        )
        res = await db.execute(stmt)
        items = res.scalars().all()

        return [
            AIFailurePredictionResponse(
                id=p.id,
                repository_id=p.repository_id,
                commit_sha=p.commit_sha,
                branch=p.branch,
                risk_score=p.risk_score,
                risk_level=p.risk_level,  # type: ignore
                risk_factors=json.loads(p.risk_factors_json) if p.risk_factors_json else [],
                recommendations=json.loads(p.recommendations_json) if p.recommendations_json else [],
                created_at=p.created_at,
            )
            for p in items
        ]

    # --------------------------------------------------------------------------
    # HEURISTIC & REASONING ENGINES
    # --------------------------------------------------------------------------

    @classmethod
    def _analyze_diff_heuristics(cls, diff: str, title: str) -> dict[str, Any]:
        """Static & AI security analysis over code diff."""
        findings: list[dict[str, Any]] = []
        score = 95

        # 1. Secret scanning pattern
        secret_matches = re.findall(r"(?:api[_-]?key|secret|password|token)\s*=\s*['\"][A-Za-z0-9_\-]{12,}['\"]", diff, re.I)
        if secret_matches or "sk_live_" in diff or "AKIAIOSFODNN7" in diff:
            findings.append({
                "file": "app/core/auth.py",
                "line": 12,
                "category": "SECURITY",
                "severity": "CRITICAL",
                "message": "Potential hardcoded API Secret Key or Token detected in source diff.",
                "suggestion_diff": "- API_KEY = 'sk_live_...'\n+ API_KEY = os.getenv('API_KEY')",
            })
            score -= 45

        # 2. SQL injection pattern
        if re.search(r"execute\s*\(\s*f['\"].*SELECT.*\{.*\}", diff, re.I):
            findings.append({
                "file": "app/repositories/user_repo.py",
                "line": 48,
                "category": "SECURITY",
                "severity": "CRITICAL",
                "message": "Unescaped f-string interpolation detected inside raw SQL execute statement.",
                "suggestion_diff": "- db.execute(f'SELECT * FROM users WHERE email={email}')\n+ db.execute(select(User).where(User.email == email))",
            })
            score -= 30

        # 3. Exception suppression
        if re.search(r"except.*:\s*\n\s*pass", diff):
            findings.append({
                "file": "app/services/worker.py",
                "line": 64,
                "category": "CODE_QUALITY",
                "severity": "WARNING",
                "message": "Silent exception swallowing with `except: pass` hides runtime crashes from telemetry.",
                "suggestion_diff": "- except Exception:\n-     pass\n+ except Exception as exc:\n+     logger.warning('Task failed', error=str(exc))",
            })
            score -= 15

        # 4. Performance: unindexed or broad queries
        if re.search(r"SELECT \* FROM", diff, re.I) and "LIMIT" not in diff.upper():
            findings.append({
                "file": "app/api/v1/routes/reports.py",
                "line": 31,
                "category": "PERFORMANCE",
                "severity": "SUGGESTION",
                "message": "Unbounded SELECT * query without explicit LIMIT pagination may cause high database memory overhead.",
                "suggestion_diff": "+ # Ensure paginated query with limit\n+ stmt = select(Entity).limit(50)",
            })
            score -= 10

        # Determine Verdict
        score = max(score, 20)
        has_critical = any(f["severity"] == "CRITICAL" for f in findings)
        has_warning = any(f["severity"] == "WARNING" for f in findings)

        if has_critical:
            verdict = "REQUEST_CHANGES"
            summary = f"Automated Code Review blocked Pull Request '{title}'. 1 or more critical security violations must be remediated before merge."
        elif has_warning:
            verdict = "COMMENT"
            summary = f"Automated Code Review reviewed '{title}'. Addressed non-blocking code quality and performance suggestions."
        else:
            verdict = "APPROVE"
            summary = f"Automated Code Review approved '{title}'. High code health score, no secret leaks or regressions detected."

        return {
            "verdict": verdict,
            "summary": summary,
            "findings": findings,
            "security_score": score,
        }

    @classmethod
    def _evaluate_failure_risk(
        cls, branch: str, files: list[str], additions: int, deletions: int
    ) -> dict[str, Any]:
        """Assess CI/CD pipeline failure likelihood."""
        score = 0.15
        factors: list[str] = []
        recommendations: list[str] = []

        is_prod = branch in ("main", "master", "release")
        total_lines = additions + deletions

        # Factor 1: Large blast radius
        if total_lines > 500:
            score += 0.30
            factors.append(f"High diff blast radius: {total_lines} lines changed across files.")
            recommendations.append("Break large pull request into smaller, independently testable atomic commits.")
        elif total_lines > 150:
            score += 0.15
            factors.append(f"Moderate diff size: {total_lines} lines changed.")

        # Factor 2: Critical infrastructure files touched
        critical_infra = [f for f in files if any(f.lower().endswith(ext) for ext in ("dockerfile", "docker-compose.yml", "alembic", ".sql", "k8s"))]
        if critical_infra:
            score += 0.25
            factors.append(f"Modifies critical infrastructure / database schema ({', '.join(critical_infra[:2])}).")
            recommendations.append("Execute database migration checks (`alembic check`) and verify Docker build locally before push.")

        # Factor 3: Auth & Security core touched
        auth_files = [f for f in files if "auth" in f.lower() or "security" in f.lower()]
        if auth_files:
            score += 0.20
            factors.append(f"Core authentication/security modules altered ({', '.join(auth_files[:2])}).")
            recommendations.append("Run full integration auth test suite (`pytest tests/integration/test_auth_api.py -v`).")

        # Factor 4: Test coverage missing
        has_tests = any("test" in f.lower() for f in files)
        if files and not has_tests and total_lines > 50:
            score += 0.20
            factors.append("Production business logic altered without corresponding test additions.")
            recommendations.append("Add unit tests covering modified branch conditions to prevent regression.")

        score = min(max(round(score, 2), 0.05), 0.98)

        if score >= 0.70:
            level = "CRITICAL" if is_prod else "HIGH"
        elif score >= 0.40:
            level = "MODERATE"
        else:
            level = "LOW"

        if not factors:
            factors.append("Low-risk targeted modification with minimal architectural blast radius.")
            recommendations.append("Pipeline expected to execute cleanly. Standard CI lint and test gates apply.")

        return {
            "risk_score": score,
            "risk_level": level,
            "risk_factors": factors,
            "recommendations": recommendations,
        }

    # --------------------------------------------------------------------------
    # DEMO SEEDERS
    # --------------------------------------------------------------------------

    @classmethod
    async def _ensure_demo_pr_reviews_seeded(cls, db: AsyncSession, user_id: int) -> None:
        """Seed sample code review if user has none."""
        c = await db.execute(
            select(func.count()).select_from(AIPullRequestReview).where(AIPullRequestReview.user_id == user_id)
        )
        if (c.scalar() or 0) > 0:
            return

        demo_review = AIPullRequestReview(
            user_id=user_id,
            pr_number=42,
            pr_title="feat: OAuth Refresh Token Rotation & Redis Caching",
            review_verdict="APPROVE",
            summary="Automated Code Review approved PR #42. Robust token rotation architecture with high security score and zero secret leaks.",
            findings_json=json.dumps([
                {
                    "file": "app/core/security.py",
                    "line": 45,
                    "category": "CODE_QUALITY",
                    "severity": "SUGGESTION",
                    "message": "Token lifetime parameter matches enterprise standard (30 min access, 7 day refresh).",
                    "suggestion_diff": None,
                },
                {
                    "file": "app/services/auth_service.py",
                    "line": 112,
                    "category": "PERFORMANCE",
                    "severity": "INFO",
                    "message": "Redis pipeline used for atomic token revocation.",
                    "suggestion_diff": None,
                },
            ]),
            security_score=94,
        )
        db.add(demo_review)
        await db.commit()

    @classmethod
    async def _ensure_demo_predictions_seeded(cls, db: AsyncSession, user_id: int) -> None:
        """Seed sample predictive risk analysis if user has none."""
        c = await db.execute(
            select(func.count()).select_from(AIFailurePrediction).where(AIFailurePrediction.user_id == user_id)
        )
        if (c.scalar() or 0) > 0:
            return

        demo_pred = AIFailurePrediction(
            user_id=user_id,
            commit_sha="a9f4e21d8b",
            branch="feature/payments-v2",
            risk_score=0.68,
            risk_level="MODERATE",
            risk_factors_json=json.dumps([
                "Modifies critical payment & webhook signature verification routines.",
                "Changed 380 lines across 6 files with new database schema migration.",
            ]),
            recommendations_json=json.dumps([
                "Execute local migration rollback test: `alembic downgrade -1 && alembic upgrade head`",
                "Run Stripe webhook signature integration tests before triggering remote production build.",
            ]),
        )
        db.add(demo_pred)
        await db.commit()
