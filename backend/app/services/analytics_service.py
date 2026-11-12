"""Analytics calculation and chart data generation business logic."""

from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.commit import Commit
from app.models.deployment import Deployment
from app.models.github_account import GitHubAccount
from app.models.issue import Issue
from app.models.pull_request import PullRequest
from app.models.repository import Repository
from app.models.workflow_run import WorkflowRun
from app.schemas.analytics import (
    ActivityItem,
    BuildTrendResponse,
    ChartDataPoint,
    DashboardStats,
    DoraMetric,
    DoraMetricsResponse,
    RecentActivityResponse,
    RepositoryActivityResponse,
    WorkflowPerformanceResponse,
)


class AnalyticsService:
    """Service computing repository, workflow, commit, and CI/CD metrics."""

    @staticmethod
    def _build_repo_subq(user_id: int, organization_id: int | None = None, with_name: bool = False):
        """Build repository subquery scoped to organization or fallback to user's connected GitHub accounts."""
        if organization_id is not None:
            if with_name:
                return (
                    select(Repository.id, Repository.name)
                    .where(Repository.organization_id == organization_id)
                ).subquery()
            return select(Repository.id).where(Repository.organization_id == organization_id).subquery()
        else:
            if with_name:
                return (
                    select(Repository.id, Repository.name)
                    .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
                    .where(GitHubAccount.user_id == user_id)
                ).subquery()
            return (
                select(Repository.id)
                .join(GitHubAccount, Repository.github_account_id == GitHubAccount.id)
                .where(GitHubAccount.user_id == user_id)
            ).subquery()

    @staticmethod
    async def get_dashboard_stats(
        db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> DashboardStats:
        """Calculate high-level dashboard metrics for a workspace's repositories."""
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id)

        # Total Repositories
        repo_count_res = await db.execute(
            select(func.count()).select_from(repo_subq)
        )
        total_repos = repo_count_res.scalar() or 0

        # Total Commits
        commit_res = await db.execute(
            select(func.count())
            .select_from(Commit)
            .where(Commit.repository_id.in_(select(repo_subq)))
        )
        total_commits = commit_res.scalar() or 0

        # Total Pull Requests
        pr_res = await db.execute(
            select(func.count())
            .select_from(PullRequest)
            .where(PullRequest.repository_id.in_(select(repo_subq)))
        )
        total_prs = pr_res.scalar() or 0

        # Open Issues
        issue_res = await db.execute(
            select(func.count())
            .select_from(Issue)
            .where(
                Issue.repository_id.in_(select(repo_subq)),
                Issue.state == "open",
            )
        )
        open_issues = issue_res.scalar() or 0

        # Successful Builds
        success_builds_res = await db.execute(
            select(func.count())
            .select_from(WorkflowRun)
            .where(
                WorkflowRun.repository_id.in_(select(repo_subq)),
                WorkflowRun.conclusion == "success",
            )
        )
        successful_builds = success_builds_res.scalar() or 0

        # Failed Builds
        failed_builds_res = await db.execute(
            select(func.count())
            .select_from(WorkflowRun)
            .where(
                WorkflowRun.repository_id.in_(select(repo_subq)),
                WorkflowRun.conclusion == "failure",
            )
        )
        failed_builds = failed_builds_res.scalar() or 0

        total_concluded = successful_builds + failed_builds
        success_rate = (
            round((successful_builds / total_concluded) * 100, 1)
            if total_concluded > 0
            else 0.0
        )

        # Deployments: query official deployments or successful CD/main workflow runs
        dep_res = await db.execute(
            select(func.count())
            .select_from(Deployment)
            .where(Deployment.repository_id.in_(select(repo_subq)))
        )
        total_deployments = dep_res.scalar() or 0
        if total_deployments == 0:
            cd_res = await db.execute(
                select(func.count())
                .select_from(WorkflowRun)
                .where(
                    WorkflowRun.repository_id.in_(select(repo_subq)),
                    WorkflowRun.conclusion == "success",
                    WorkflowRun.branch.in_(["main", "master", "release", "prod", "production"]),
                )
            )
            total_deployments = cd_res.scalar() or 0

        return DashboardStats(
            total_repositories=total_repos,
            total_commits=total_commits,
            total_pull_requests=total_prs,
            open_issues=open_issues,
            successful_builds=successful_builds,
            failed_builds=failed_builds,
            build_success_rate=success_rate,
            total_deployments=total_deployments,
        )

    @staticmethod
    async def get_recent_activity(
        db: AsyncSession, user_id: int, limit: int = 15, organization_id: int | None = None
    ) -> RecentActivityResponse:
        """Fetch latest mixed feed of commits, PRs, workflow runs, and issues."""
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id, with_name=True)

        activities: list[ActivityItem] = []

        # 1. Recent Workflow Runs
        wf_q = (
            select(WorkflowRun, Repository.name.label("repo_name"))
            .join(Repository, WorkflowRun.repository_id == Repository.id)
            .where(WorkflowRun.repository_id.in_(select(repo_subq.c.id)))
            .order_by(WorkflowRun.id.desc())
            .limit(limit)
        )
        wf_res = await db.execute(wf_q)
        for run, repo_name in wf_res.all():
            status_desc = run.conclusion or run.status
            activities.append(
                ActivityItem(
                    type="workflow",
                    title=f"{run.workflow_name} #{run.run_number}",
                    description=f"Status: {status_desc} on {run.branch or 'default'}",
                    timestamp=run.completed_at or run.started_at or run.created_at,
                    repository_name=repo_name,
                    url=run.url,
                    author=None,
                )
            )

        # 2. Recent Commits
        cm_q = (
            select(Commit, Repository.name.label("repo_name"))
            .join(Repository, Commit.repository_id == Repository.id)
            .where(Commit.repository_id.in_(select(repo_subq.c.id)))
            .order_by(Commit.id.desc())
            .limit(limit)
        )
        cm_res = await db.execute(cm_q)
        for c, repo_name in cm_res.all():
            msg = c.message.split("\n")[0][:80]
            activities.append(
                ActivityItem(
                    type="commit",
                    title=f"Commit {c.sha[:7]} by {c.author_name}",
                    description=msg,
                    timestamp=c.author_date,
                    repository_name=repo_name,
                    url=c.url,
                    author=c.author_name,
                )
            )

        # 3. Recent Pull Requests
        pr_q = (
            select(PullRequest, Repository.name.label("repo_name"))
            .join(Repository, PullRequest.repository_id == Repository.id)
            .where(PullRequest.repository_id.in_(select(repo_subq.c.id)))
            .order_by(PullRequest.id.desc())
            .limit(limit)
        )
        pr_res = await db.execute(pr_q)
        for p, repo_name in pr_res.all():
            activities.append(
                ActivityItem(
                    type="pr",
                    title=f"PR #{p.number}: {p.title[:60]}",
                    description=f"State: {p.state} by {p.author or 'contributor'}",
                    timestamp=p.created_at_gh or p.created_at,
                    repository_name=repo_name,
                    url=p.url,
                    author=p.author,
                )
            )

        # Sort activities combined by timestamp desc
        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return RecentActivityResponse(activities=activities[:limit])

    @staticmethod
    async def get_workflow_performance(
        db: AsyncSession, user_id: int, days: int = 14, organization_id: int | None = None
    ) -> WorkflowPerformanceResponse:
        """Generate daily average workflow run duration."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id)

        # Query runs by execution date
        date_expr = func.date(func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at))
        q = (
            select(
                date_expr.label("day"),
                func.avg(WorkflowRun.duration_seconds).label("avg_duration"),
            )
            .where(
                WorkflowRun.repository_id.in_(select(repo_subq)),
                func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at) >= cutoff,
                WorkflowRun.duration_seconds.isnot(None),
            )
            .group_by(date_expr)
            .order_by(date_expr)
        )
        res = await db.execute(q)
        data_map = {str(row.day): float(row.avg_duration or 0) for row in res.all()}

        # Fill all days
        chart_data: list[ChartDataPoint] = []
        for i in range(days):
            date_key = (cutoff + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            chart_data.append(
                ChartDataPoint(
                    label=date_key,
                    value=round(data_map.get(date_key, 0.0), 1),
                )
            )

        return WorkflowPerformanceResponse(chart_data=chart_data)

    @staticmethod
    async def get_repository_activity(
        db: AsyncSession, user_id: int, days: int = 14, organization_id: int | None = None
    ) -> RepositoryActivityResponse:
        """Generate daily commit frequency for user's repositories."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id)

        q = (
            select(
                func.date(Commit.author_date).label("day"),
                func.count(Commit.id).label("count"),
            )
            .where(
                Commit.repository_id.in_(select(repo_subq)),
                Commit.author_date >= cutoff,
            )
            .group_by(func.date(Commit.author_date))
            .order_by(func.date(Commit.author_date))
        )
        res = await db.execute(q)
        data_map = {str(row.day): float(row.count) for row in res.all()}

        chart_data: list[ChartDataPoint] = []
        for i in range(days):
            date_key = (cutoff + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            chart_data.append(
                ChartDataPoint(
                    label=date_key,
                    value=data_map.get(date_key, 0.0),
                )
            )

        return RepositoryActivityResponse(chart_data=chart_data)

    @staticmethod
    async def get_build_trends(
        db: AsyncSession, user_id: int, days: int = 30, organization_id: int | None = None
    ) -> BuildTrendResponse:
        """Generate daily success vs failure build trends over time."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id)

        date_expr = func.date(func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at))
        q = (
            select(
                date_expr.label("day"),
                WorkflowRun.conclusion,
                func.count(WorkflowRun.id).label("count"),
            )
            .where(
                WorkflowRun.repository_id.in_(select(repo_subq)),
                func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at) >= cutoff,
            )
            .group_by(date_expr, WorkflowRun.conclusion)
        )
        res = await db.execute(q)

        success_map: dict[str, int] = {}
        failure_map: dict[str, int] = {}
        for row in res.all():
            day_str = str(row.day)
            if row.conclusion == "success":
                success_map[day_str] = row.count
            elif row.conclusion == "failure":
                failure_map[day_str] = row.count

        labels: list[str] = []
        success_list: list[int] = []
        failure_list: list[int] = []
        for i in range(days):
            date_key = (cutoff + timedelta(days=i + 1)).strftime("%Y-%m-%d")
            labels.append(date_key)
            success_list.append(success_map.get(date_key, 0))
            failure_list.append(failure_map.get(date_key, 0))

        return BuildTrendResponse(
            labels=labels,
            success=success_list,
            failure=failure_list,
        )

    @staticmethod
    async def get_dora_metrics(
        db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> DoraMetricsResponse:
        """Calculate the 4 core DORA metrics (DevOps Research and Assessment)."""
        repo_subq = AnalyticsService._build_repo_subq(user_id, organization_id)

        # 1. Total deployments & frequency in past 30 days
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        dep_q = select(func.count(Deployment.id)).where(
            Deployment.repository_id.in_(select(repo_subq)),
            Deployment.created_at >= cutoff,
        )
        total_deps = (await db.execute(dep_q)).scalar() or 0
        if total_deps == 0:
            # Check successful production/main workflow runs as deployment proxy
            wf_dep_q = select(func.count(WorkflowRun.id)).where(
                WorkflowRun.repository_id.in_(select(repo_subq)),
                WorkflowRun.conclusion == "success",
                WorkflowRun.branch.in_(["main", "master", "release", "prod", "production"]),
                func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at) >= cutoff,
            )
            total_deps = (await db.execute(wf_dep_q)).scalar() or 0

        deps_per_week = round(total_deps / 4.2, 1)

        if total_deps == 0:
            df_rating = "No Data"
            df_val = "0/wk"
            df_desc = "No deployments recorded in the past 30 days"
        elif deps_per_week >= 7:
            df_rating = "Elite"
            df_val = f"{deps_per_week}/wk"
            df_desc = "Deploying on demand multiple times per day"
        elif deps_per_week >= 1:
            df_rating = "High"
            df_val = f"{deps_per_week}/wk"
            df_desc = "Deploying between once per day and once per week"
        elif deps_per_week >= 0.25:
            df_rating = "Medium"
            df_val = f"{deps_per_week}/wk"
            df_desc = "Deploying between once per week and once per month"
        else:
            df_rating = "Low"
            df_val = f"{deps_per_week}/wk"
            df_desc = "Deploying less than once per month"

        # 2. Change Failure Rate (failed vs total workflows/deployments)
        wf_q = select(
            func.count(WorkflowRun.id).filter(WorkflowRun.conclusion == "failure"),
            func.count(WorkflowRun.id),
        ).where(
            WorkflowRun.repository_id.in_(select(repo_subq)),
            func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at) >= cutoff,
        )
        wf_res = (await db.execute(wf_q)).one_or_none()
        failed_count, total_runs = (wf_res[0] or 0, wf_res[1] or 0) if wf_res else (0, 0)

        if total_runs == 0:
            cfr = 0.0
            cfr_val = "N/A"
            cfr_rating = "No Data"
            cfr_desc = "No pipeline runs recorded in the past 30 days"
        else:
            cfr = round((failed_count / total_runs * 100), 1)
            cfr_val = f"{cfr}%"
            cfr_desc = "Percentage of releases resulting in pipeline or service failures"
            if cfr <= 5.0:
                cfr_rating = "Elite"
            elif cfr <= 15.0:
                cfr_rating = "High"
            elif cfr <= 30.0:
                cfr_rating = "Medium"
            else:
                cfr_rating = "Low"

        # 3. Lead Time for Changes (average duration of successful pipeline execution)
        dur_q = select(func.avg(WorkflowRun.duration_seconds)).where(
            WorkflowRun.repository_id.in_(select(repo_subq)),
            WorkflowRun.conclusion == "success",
            WorkflowRun.duration_seconds.isnot(None),
            func.coalesce(WorkflowRun.started_at, WorkflowRun.created_at) >= cutoff,
        )
        avg_seconds = (await db.execute(dur_q)).scalar()

        if avg_seconds is None or total_runs == 0:
            lead_time_min = 0.0
            lt_val = "N/A"
            lt_rating = "No Data"
            lt_desc = "No completed workflow runs to calculate lead time"
        else:
            lead_time_min = round(avg_seconds / 60, 1)
            lt_desc = "Time from commit to production release"
            if lead_time_min < 1.0:
                lt_rating = "Elite"
                lt_val = f"{lead_time_min} mins"
            elif lead_time_min <= 60:
                lt_rating = "Elite"
                lt_val = f"{round(lead_time_min, 1)} mins"
            elif lead_time_min <= 1440:
                lt_rating = "High"
                lt_val = f"{round(lead_time_min / 60, 1)} hrs"
            else:
                lt_rating = "Medium"
                lt_val = f"{round(lead_time_min / 1440, 1)} days"

        # 4. Mean Time to Restore Service (MTTR) calculated from real recovery durations
        if failed_count == 0:
            mttr_min = 0.0
            mttr_val = "N/A"
            mttr_rating = "No Data"
            mttr_desc = "No pipeline failure incidents recorded in the past 30 days"
        else:
            from sqlalchemy import text
            if organization_id is not None:
                rec_sql = text("""
                    SELECT f.started_at as failed_at,
                           (SELECT min(s.completed_at) FROM workflow_runs s
                            WHERE s.repository_id = f.repository_id
                              AND s.workflow_name = f.workflow_name
                              AND s.conclusion = 'success'
                              AND s.completed_at >= f.started_at) as recovered_at
                    FROM workflow_runs f
                    WHERE f.conclusion = 'failure'
                      AND f.repository_id IN (SELECT id FROM repositories WHERE organization_id = :org_id)
                      AND f.created_at >= :cutoff
                """)
                rec_res = await db.execute(rec_sql, {"org_id": organization_id, "cutoff": cutoff})
            else:
                rec_sql = text("""
                    SELECT f.started_at as failed_at,
                           (SELECT min(s.completed_at) FROM workflow_runs s
                            WHERE s.repository_id = f.repository_id
                              AND s.workflow_name = f.workflow_name
                              AND s.conclusion = 'success'
                              AND s.completed_at >= f.started_at) as recovered_at
                    FROM workflow_runs f
                    WHERE f.conclusion = 'failure'
                      AND f.repository_id IN (SELECT id FROM repositories WHERE github_account_id IN (SELECT id FROM github_accounts WHERE user_id = :u_id))
                      AND f.created_at >= :cutoff
                """)
                rec_res = await db.execute(rec_sql, {"u_id": user_id, "cutoff": cutoff})
            recovery_diffs = []
            for row in rec_res.all():
                if row.failed_at and row.recovered_at:
                    d_min = (row.recovered_at - row.failed_at).total_seconds() / 60.0
                    if d_min >= 0:
                        recovery_diffs.append(d_min)

            if recovery_diffs:
                mttr_min = round(sum(recovery_diffs) / len(recovery_diffs), 1)
                mttr_val = f"{mttr_min} mins"
                mttr_desc = f"Average recovery across {len(recovery_diffs)} resolved incidents"
                if mttr_min < 60:
                    mttr_rating = "Elite"
                elif mttr_min < 1440:
                    mttr_rating = "High"
                else:
                    mttr_rating = "Medium"
            else:
                mttr_min = 0.0
                mttr_val = "N/A"
                mttr_rating = "No Data"
                mttr_desc = "No resolved recovery events in the past 30 days"

        # Overall scorecard
        active_ratings = [r for r in [df_rating, cfr_rating, lt_rating, mttr_rating] if r != "No Data"]
        if not active_ratings:
            overall = "Insufficient Data"
        elif active_ratings.count("Elite") >= 2:
            overall = "Elite"
        elif active_ratings.count("High") >= 2:
            overall = "High"
        else:
            overall = "Medium"

        return DoraMetricsResponse(
            deployment_frequency=DoraMetric(
                name="Deployment Frequency",
                value=df_val,
                numeric_value=deps_per_week,
                unit="per week",
                rating=df_rating,
                benchmark="Elite: Multiple per day",
                description=df_desc,
            ),
            lead_time_for_changes=DoraMetric(
                name="Lead Time for Changes",
                value=lt_val,
                numeric_value=lead_time_min,
                unit="minutes",
                rating=lt_rating,
                benchmark="Elite: < 1 hour",
                description=lt_desc,
            ),
            change_failure_rate=DoraMetric(
                name="Change Failure Rate",
                value=cfr_val,
                numeric_value=cfr,
                unit="percent",
                rating=cfr_rating,
                benchmark="Elite: 0 - 5%",
                description=cfr_desc,
            ),
            mean_time_to_recovery=DoraMetric(
                name="Mean Time to Restore (MTTR)",
                value=mttr_val,
                numeric_value=mttr_min,
                unit="minutes",
                rating=mttr_rating,
                benchmark="Elite: < 1 hour",
                description=mttr_desc,
            ),
            overall_performance=overall,
        )

