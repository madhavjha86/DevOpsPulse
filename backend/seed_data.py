"""Seed initial demo users and sample CI/CD data for DevOpsPulse."""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from app.db.session import async_engine, AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.github_account import GitHubAccount
from app.models.repository import Repository
from app.models.workflow_run import WorkflowRun
from app.models.deployment import Deployment
from app.models.commit import Commit
from app.models.pull_request import PullRequest
from app.models.issue import Issue
from app.models.notification import Notification


async def seed():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        res = await session.execute(select(User).where(User.email == "admin@devopspulse.com"))
        existing_user = res.scalars().first()
        if existing_user:
            print("Database already contains demo users.")
            return

        print("Seeding demo users and monitoring data...")

        # 1. Admin User
        admin_user = User(
            email="admin@devopspulse.com",
            username="admin",
            hashed_password=hash_password("Password123!"),
            full_name="System Administrator",
            is_active=True,
            is_superuser=True,
            role="admin",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
        )
        session.add(admin_user)

        # 2. Developer User (matches screenshot placeholder)
        dev_user = User(
            email="developer@company.com",
            username="developer",
            hashed_password=hash_password("Password123!"),
            full_name="Alex Rivera",
            is_active=True,
            is_superuser=False,
            role="user",
            avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
        )
        session.add(dev_user)
        await session.flush()

        # 3. GitHub Account for Admin
        gh_acc = GitHubAccount(
            user_id=admin_user.id,
            github_id=987654321,
            github_username="devopspulse-team",
            access_token="ghp_demo_mock_token_for_local_development_12345",
            avatar_url="https://avatars.githubusercontent.com/u/9919?v=4",
            token_scope="repo,workflow,user",
        )
        session.add(gh_acc)
        await session.flush()

        # 4. Repositories
        now = datetime.now(timezone.utc)
        repo1 = Repository(
            github_account_id=gh_acc.id,
            github_id=10101,
            name="devopspulse-core",
            full_name="devopspulse-team/devopspulse-core",
            description="Core monitoring engine and real-time event aggregation pipeline",
            url="https://api.github.com/repos/devopspulse-team/devopspulse-core",
            html_url="https://github.com/devopspulse-team/devopspulse-core",
            language="Python",
            stars_count=342,
            forks_count=48,
            open_issues_count=6,
            is_private=False,
            default_branch="main",
            last_synced_at=now,
            is_active=True,
        )
        repo2 = Repository(
            github_account_id=gh_acc.id,
            github_id=10102,
            name="devopspulse-web",
            full_name="devopspulse-team/devopspulse-web",
            description="Next-gen analytics and monitoring dashboard built with React and Tailwind",
            url="https://api.github.com/repos/devopspulse-team/devopspulse-web",
            html_url="https://github.com/devopspulse-team/devopspulse-web",
            language="TypeScript",
            stars_count=189,
            forks_count=22,
            open_issues_count=3,
            is_private=False,
            default_branch="main",
            last_synced_at=now,
            is_active=True,
        )
        session.add_all([repo1, repo2])
        await session.flush()

        # 5. Workflow Runs
        wf_runs = [
            WorkflowRun(
                repository_id=repo1.id,
                github_id=2001,
                workflow_name="CI / Tests & Lint",
                workflow_id=501,
                run_number=142,
                status="completed",
                conclusion="success",
                branch="main",
                event="push",
                url="https://github.com/devopspulse-team/devopspulse-core/actions/runs/2001",
                started_at=now - timedelta(minutes=45),
                completed_at=now - timedelta(minutes=42),
                duration_seconds=180,
            ),
            WorkflowRun(
                repository_id=repo1.id,
                github_id=2002,
                workflow_name="Release Pipeline",
                workflow_id=502,
                run_number=88,
                status="completed",
                conclusion="success",
                branch="main",
                event="push",
                url="https://github.com/devopspulse-team/devopspulse-core/actions/runs/2002",
                started_at=now - timedelta(hours=3),
                completed_at=now - timedelta(hours=3, minutes=-12),
                duration_seconds=720,
            ),
            WorkflowRun(
                repository_id=repo2.id,
                github_id=2003,
                workflow_name="Frontend E2E Tests",
                workflow_id=503,
                run_number=95,
                status="completed",
                conclusion="failure",
                branch="feature/chart-tooltips",
                event="pull_request",
                url="https://github.com/devopspulse-team/devopspulse-web/actions/runs/2003",
                started_at=now - timedelta(hours=1),
                completed_at=now - timedelta(hours=1, minutes=-4),
                duration_seconds=240,
            ),
            WorkflowRun(
                repository_id=repo2.id,
                github_id=2004,
                workflow_name="Production Deploy",
                workflow_id=504,
                run_number=54,
                status="completed",
                conclusion="success",
                branch="main",
                event="push",
                url="https://github.com/devopspulse-team/devopspulse-web/actions/runs/2004",
                started_at=now - timedelta(hours=6),
                completed_at=now - timedelta(hours=6, minutes=-8),
                duration_seconds=480,
            ),
        ]
        session.add_all(wf_runs)

        # 6. Deployments
        deployments = [
            Deployment(
                repository_id=repo1.id,
                github_id=3001,
                environment="production",
                status="success",
                description="Deployed core engine v1.0.0",
                ref="main",
                sha="a1b2c3d4e5f6789012345678901234567890abcd",
                url="https://github.com/devopspulse-team/devopspulse-core/deployments/3001",
                deployed_at=now - timedelta(hours=4),
                creator="admin",
            ),
            Deployment(
                repository_id=repo2.id,
                github_id=3002,
                environment="staging",
                status="success",
                description="Preview deployment for PR #12",
                ref="feature/chart-tooltips",
                sha="f6e5d4c3b2a1098765432109876543210987dcba",
                url="https://github.com/devopspulse-team/devopspulse-web/deployments/3002",
                deployed_at=now - timedelta(hours=2),
                creator="developer",
            ),
        ]
        session.add_all(deployments)

        # 7. Commits
        commits = [
            Commit(
                repository_id=repo1.id,
                sha="a1b2c3d4e5f6789012345678901234567890abcd",
                message="feat(api): optimize pipeline metrics aggregation and cache queries",
                author_name="Alex Rivera",
                author_email="developer@company.com",
                author_date=now - timedelta(hours=5),
                url="https://github.com/devopspulse-team/devopspulse-core/commit/a1b2c3d",
                additions=142,
                deletions=28,
            ),
            Commit(
                repository_id=repo2.id,
                sha="c3d4e5f6a1b2789012345678901234567890ef01",
                message="fix(ui): responsive card padding on small viewports",
                author_name="Alex Rivera",
                author_email="developer@company.com",
                author_date=now - timedelta(hours=3),
                url="https://github.com/devopspulse-team/devopspulse-web/commit/c3d4e5f",
                additions=35,
                deletions=12,
            ),
        ]
        session.add_all(commits)

        # 8. Pull Requests & Issues
        prs = [
            PullRequest(
                repository_id=repo2.id,
                github_id=4001,
                number=12,
                title="feat(charts): interactive tooltips for workflow performance graph",
                state="open",
                author="developer",
                url="https://github.com/devopspulse-team/devopspulse-web/pull/12",
                created_at_gh=now - timedelta(days=1),
                additions=230,
                deletions=45,
            )
        ]
        session.add_all(prs)

        issues = [
            Issue(
                repository_id=repo1.id,
                github_id=5001,
                number=42,
                title="Improve rate-limit backoff header handling during mass repo sync",
                state="open",
                author="octocat",
                url="https://github.com/devopspulse-team/devopspulse-core/issues/42",
                labels='["enhancement","backend"]',
                created_at_gh=now - timedelta(days=2),
            )
        ]
        session.add_all(issues)

        # 9. In-App Notifications
        notifications = [
            Notification(
                user_id=admin_user.id,
                title="Build Failure Alert",
                message="Workflow 'Frontend E2E Tests' #95 failed on branch 'feature/chart-tooltips'.",
                type="build_failure",
                is_read=False,
                reference_type="workflow_run",
                reference_id=2003,
            ),
            Notification(
                user_id=admin_user.id,
                title="Deployment Succeeded",
                message="Deployment #3001 to 'production' completed successfully.",
                type="build_success",
                is_read=True,
                reference_type="deployment",
                reference_id=3001,
            ),
        ]
        session.add_all(notifications)

        await session.commit()
        print("Demo data seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
