"""Pydantic schemas for AI Pull Request Reviewer and CI/CD Failure Prediction."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class PRReviewFinding(BaseModel):
    """An individual code review suggestion or security finding."""

    file: str
    line: int | None = None
    category: Literal["SECURITY", "PERFORMANCE", "CODE_QUALITY", "TEST_COVERAGE"]
    severity: Literal["CRITICAL", "WARNING", "SUGGESTION", "INFO"]
    message: str
    suggestion_diff: str | None = None


class GeneratePRReviewRequest(BaseModel):
    """Payload to trigger an AI review on a pull request diff."""

    pull_request_id: int | None = None
    repository_id: int | None = None
    pr_number: int = 1
    pr_title: str | None = None
    diff_content: str | None = Field(default=None, max_length=100000)


class AIPullRequestReviewResponse(BaseModel):
    """Automated AI Code Review report."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    pull_request_id: int | None = None
    repository_id: int | None = None
    pr_number: int
    pr_title: str
    review_verdict: Literal["APPROVE", "REQUEST_CHANGES", "COMMENT"]
    summary: str
    findings: list[PRReviewFinding] = []
    security_score: int
    created_at: datetime


class PredictFailureRequest(BaseModel):
    """Payload to predict CI/CD failure probability for a commit or PR."""

    repository_id: int | None = None
    commit_sha: str | None = None
    branch: str = "main"
    changed_files: list[str] = Field(default_factory=list)
    additions: int = 0
    deletions: int = 0


class AIFailurePredictionResponse(BaseModel):
    """Predictive failure risk score and pre-flight recommendations."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    repository_id: int | None = None
    commit_sha: str
    branch: str
    risk_score: float
    risk_level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    risk_factors: list[str] = []
    recommendations: list[str] = []
    created_at: datetime
