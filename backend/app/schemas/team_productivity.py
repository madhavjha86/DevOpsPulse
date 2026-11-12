"""Pydantic schemas for Engineering Team Productivity Analytics."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class TeamCreate(BaseModel):
    """Payload to create or configure an engineering team."""

    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    repository_ids: list[int] = Field(default_factory=list)
    target_lead_time_hours: float = Field(default=24.0, gt=0)
    target_deployment_freq_per_day: float = Field(default=2.0, gt=0)
    target_review_time_hours: float = Field(default=4.0, gt=0)


class TeamResponse(BaseModel):
    """Configured engineering team summary."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    target_lead_time_hours: float
    target_deployment_freq_per_day: float
    target_review_time_hours: float
    repository_count: int = 0
    created_at: datetime


class PRReviewMetrics(BaseModel):
    """Pull request review duration and queue turnaround metrics."""

    median_time_to_first_review_hours: float
    median_time_to_merge_hours: float
    average_review_turnaround_hours: float
    review_coverage_percent: float
    weekly_trend: list[dict[str, Any]] = []


class PRSizeBucket(BaseModel):
    """Distribution of pull request sizes and corresponding review latencies."""

    label: str  # Small (<100 LOC), Medium (100-500 LOC), Large (>500 LOC)
    count: int
    percentage: float
    avg_review_hours: float
    recommendation: str


class TeamDoraSummary(BaseModel):
    """Team-level DORA delivery performance scorecard."""

    deployment_frequency_per_day: float
    deployment_frequency_rating: str
    lead_time_for_changes_hours: float
    lead_time_rating: str
    change_failure_rate_percent: float
    cfr_rating: str
    mttr_hours: float
    mttr_rating: str


class CollaborationInsight(BaseModel):
    """Health indicator measuring team review and process collaboration."""

    metric: str
    value: str
    status: Literal["OPTIMAL", "ATTENTION", "NEEDS_IMPROVEMENT"]
    description: str
    action_advice: str


class TeamProductivityOverview(BaseModel):
    """Consolidated engineering team productivity overview scorecard."""

    team_id: int | None = None
    team_name: str
    total_engineers_collaborating: int
    active_repositories_count: int
    dora: TeamDoraSummary
    pr_metrics: PRReviewMetrics
    pr_size_distribution: list[PRSizeBucket]
    collaboration_insights: list[CollaborationInsight]
    delivery_velocity_score: float  # 0 to 100
    process_bottlenecks: list[str]
    ranking_disclaimer: str = (
        "Individual developer rankings are disabled by design. DevOpsPulse measures team delivery flow, "
        "batch sizing, and review turnaround to foster blameless, high-velocity engineering."
    )
