"""Analytics Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel


class DashboardStats(BaseModel):
    """Aggregate statistics for the user dashboard."""

    total_repositories: int = 0
    total_commits: int = 0
    total_pull_requests: int = 0
    open_issues: int = 0
    successful_builds: int = 0
    failed_builds: int = 0
    build_success_rate: float = 0.0
    total_deployments: int = 0


class ActivityItem(BaseModel):
    """A single recent-activity entry."""

    type: str
    title: str
    description: str
    timestamp: datetime
    repository_name: str | None = None
    url: str | None = None
    author: str | None = None


class RecentActivityResponse(BaseModel):
    """List of recent activity items."""

    activities: list[ActivityItem]


class ChartDataPoint(BaseModel):
    """A single data point for charting."""

    label: str
    value: float


class WorkflowPerformanceResponse(BaseModel):
    """Chart data for workflow performance."""

    chart_data: list[ChartDataPoint]


class RepositoryActivityResponse(BaseModel):
    """Chart data for repository activity (e.g. commits per day)."""

    chart_data: list[ChartDataPoint]


class BuildTrendResponse(BaseModel):
    """Trend data showing success vs failure over time."""

    labels: list[str]
    success: list[int]
    failure: list[int]


class DoraMetric(BaseModel):
    """A single DORA metric score and status."""

    name: str
    value: str
    numeric_value: float
    unit: str
    rating: str  # Elite, High, Medium, Low
    benchmark: str
    description: str


class DoraMetricsResponse(BaseModel):
    """Four core DORA metrics response."""

    deployment_frequency: DoraMetric
    lead_time_for_changes: DoraMetric
    change_failure_rate: DoraMetric
    mean_time_to_recovery: DoraMetric
    overall_performance: str

