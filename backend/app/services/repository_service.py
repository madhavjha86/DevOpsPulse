"""Repository management and data synchronization business logic."""

from datetime import datetime, timezone
import json
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.logging import get_logger
from app.models.repository import Repository
from app.models.github_account import GitHubAccount
from app.repositories.repository_repo import RepositoryRepo
from app.repositories.user_repo import UserRepository
from app.schemas.repository import (
    CommitResponse,
    IssueResponse,
    PullRequestResponse,
    RepositoryListResponse,
    RepositoryResponse,
)
from app.services.github_service import GitHubService

logger = get_logger("repository_service")


class RepositoryService:
    """Service handling repository import, sync, and listing."""

    @staticmethod
    async def import_repository(
        db: AsyncSession, user_id: int, full_name: str
    ) -> RepositoryResponse:
        """Import a repository from GitHub using the user's connected GitHub account."""
        user_repo = UserRepository(db)
        gh_account = await user_repo.get_github_account_by_user_id(user_id)
        if not gh_account:
            raise BadRequestException(
                detail="No GitHub account connected. Please connect your GitHub account first."
            )

        parts = full_name.strip().split("/")
        if len(parts) != 2:
            raise BadRequestException(
                detail="Invalid repository full name format. Expected 'owner/repo'."
            )
        owner, repo_name = parts

        gh_client = GitHubService(access_token=gh_account.access_token)
        try:
            repo_data = await gh_client.get_repo(owner, repo_name)
        except NotFoundException:
            raise NotFoundException(
                detail=f"Repository '{full_name}' not found on GitHub. If this is a private repository, please connect a GitHub account with repo permissions."
            )

        repo_db = RepositoryRepo(db)
        existing = await repo_db.get_by_github_id(repo_data["id"])
        if existing:
            return RepositoryResponse.model_validate(existing)

        new_repo = await repo_db.create({
            "github_account_id": gh_account.id,
            "github_id": repo_data["id"],
            "name": repo_data["name"],
            "full_name": repo_data["full_name"],
            "description": repo_data.get("description"),
            "url": repo_data.get("url", f"https://api.github.com/repos/{full_name}"),
            "html_url": repo_data.get("html_url", f"https://github.com/{full_name}"),
            "language": repo_data.get("language"),
            "stars_count": repo_data.get("stargazers_count", 0),
            "forks_count": repo_data.get("forks_count", 0),
            "open_issues_count": repo_data.get("open_issues_count", 0),
            "is_private": repo_data.get("private", False),
            "default_branch": repo_data.get("default_branch", "main"),
            "is_active": True,
            "last_synced_at": datetime.now(timezone.utc),
        })
        await db.commit()

        # Trigger initial sync of commits, PRs, and issues
        try:
            await RepositoryService.sync_repository(db, new_repo.id, user_id)
        except Exception as exc:
            logger.warning("Initial repository sync encountered error", error=str(exc))

        refreshed = await repo_db.get(new_repo.id)
        return RepositoryResponse.model_validate(refreshed or new_repo)

    @staticmethod
    async def sync_repository(
        db: AsyncSession, repo_id: int, user_id: int
    ) -> RepositoryResponse:
        """Synchronize repository metadata, commits, PRs, and issues from GitHub."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(repo_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")

        user_repo = UserRepository(db)
        gh_account = await user_repo.get_github_account_by_user_id(user_id)
        token = gh_account.access_token if gh_account else None
        gh_client = GitHubService(access_token=token)

        owner, repo_name = repo.full_name.split("/")

        # 1. Update repo details
        try:
            gh_data = await gh_client.get_repo(owner, repo_name)
            repo.stars_count = gh_data.get("stargazers_count", repo.stars_count)
            repo.forks_count = gh_data.get("forks_count", repo.forks_count)
            repo.open_issues_count = gh_data.get("open_issues_count", repo.open_issues_count)
            repo.description = gh_data.get("description", repo.description)
            repo.language = gh_data.get("language", repo.language)
            repo.last_synced_at = datetime.now(timezone.utc)
        except Exception as exc:
            logger.error("Failed to update repository metadata", error=str(exc))

        # 2. Sync Commits
        try:
            commits = await gh_client.get_commits(owner, repo_name, per_page=30)
            commit_records = []
            for c in commits:
                commit_info = c.get("commit", {})
                author_info = commit_info.get("author", {})
                date_str = author_info.get("date")
                parsed_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if date_str else datetime.now(timezone.utc)
                commit_records.append({
                    "repository_id": repo.id,
                    "sha": c["sha"],
                    "message": commit_info.get("message", "")[:2000],
                    "author_name": author_info.get("name", "Unknown")[:255],
                    "author_email": author_info.get("email")[:255] if author_info.get("email") else None,
                    "author_date": parsed_date,
                    "url": c.get("html_url"),
                    "additions": 0,
                    "deletions": 0,
                })
            await repo_db.bulk_upsert_commits(commit_records)
        except Exception as exc:
            logger.error("Failed to sync commits", error=str(exc))

        # 3. Sync Pull Requests
        try:
            prs = await gh_client.get_pull_requests(owner, repo_name, state="all", per_page=30)
            pr_records = []
            for pr in prs:
                created_at_gh = None
                if pr.get("created_at"):
                    created_at_gh = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
                closed_at = None
                if pr.get("closed_at"):
                    closed_at = datetime.fromisoformat(pr["closed_at"].replace("Z", "+00:00"))
                merged_at = None
                if pr.get("merged_at"):
                    merged_at = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))

                author_user = pr.get("user", {})
                author = author_user.get("login") if author_user else None

                pr_records.append({
                    "repository_id": repo.id,
                    "github_id": pr["id"],
                    "number": pr["number"],
                    "title": pr.get("title", "")[:500],
                    "state": pr.get("state", "open"),
                    "author": author[:255] if author else None,
                    "url": pr.get("html_url"),
                    "created_at_gh": created_at_gh,
                    "closed_at": closed_at,
                    "merged_at": merged_at,
                    "additions": 0,
                    "deletions": 0,
                })
            await repo_db.bulk_upsert_pull_requests(pr_records)
        except Exception as exc:
            logger.error("Failed to sync pull requests", error=str(exc))

        # 4. Sync Issues
        try:
            issues = await gh_client.get_issues(owner, repo_name, state="all", per_page=30)
            issue_records = []
            for issue in issues:
                created_at_gh = None
                if issue.get("created_at"):
                    created_at_gh = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
                closed_at = None
                if issue.get("closed_at"):
                    closed_at = datetime.fromisoformat(issue["closed_at"].replace("Z", "+00:00"))

                author_user = issue.get("user", {})
                author = author_user.get("login") if author_user else None
                labels_str = json.dumps([lbl.get("name") for lbl in issue.get("labels", []) if isinstance(lbl, dict)])

                issue_records.append({
                    "repository_id": repo.id,
                    "github_id": issue["id"],
                    "number": issue["number"],
                    "title": issue.get("title", "")[:500],
                    "state": issue.get("state", "open"),
                    "author": author[:255] if author else None,
                    "url": issue.get("html_url"),
                    "labels": labels_str,
                    "created_at_gh": created_at_gh,
                    "closed_at": closed_at,
                })
            await repo_db.bulk_upsert_issues(issue_records)
        except Exception as exc:
            logger.error("Failed to sync issues", error=str(exc))

        # 5. Sync Workflow Runs
        try:
            from app.services.workflow_service import WorkflowService
            await WorkflowService.sync_workflow_runs(db, repo.id, user_id)
        except Exception as exc:
            logger.warning("Failed to sync workflow runs", error=str(exc))

        # 6. Sync Deployments
        try:
            from app.services.workflow_service import WorkflowService
            await WorkflowService.sync_deployments(db, repo.id, user_id)
        except Exception as exc:
            logger.warning("Failed to sync deployments", error=str(exc))

        await db.commit()
        refreshed = await repo_db.get(repo.id)
        return RepositoryResponse.model_validate(refreshed or repo)

    @staticmethod
    async def get_repositories(
        db: AsyncSession, user_id: int, page: int = 1, per_page: int = 20
    ) -> RepositoryListResponse:
        """Fetch paginated repositories for user."""
        repo_db = RepositoryRepo(db)
        skip = (page - 1) * per_page
        repos, total = await repo_db.get_by_user(user_id, skip=skip, limit=per_page)
        return RepositoryListResponse(
            repositories=[RepositoryResponse.model_validate(r) for r in repos],
            total=total,
            page=page,
            per_page=per_page,
        )

    @staticmethod
    async def get_repository(
        db: AsyncSession, repo_id: int, user_id: int
    ) -> RepositoryResponse:
        """Fetch single repository."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(repo_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")
        return RepositoryResponse.model_validate(repo)

    @staticmethod
    async def get_commits(
        db: AsyncSession, repo_id: int, page: int = 1, per_page: int = 20
    ) -> list[CommitResponse]:
        """Fetch paginated commits for repository."""
        repo_db = RepositoryRepo(db)
        skip = (page - 1) * per_page
        commits, _ = await repo_db.get_commits(repo_id, skip=skip, limit=per_page)
        return [CommitResponse.model_validate(c) for c in commits]

    @staticmethod
    async def get_pull_requests(
        db: AsyncSession, repo_id: int, page: int = 1, per_page: int = 20
    ) -> list[PullRequestResponse]:
        """Fetch paginated PRs for repository."""
        repo_db = RepositoryRepo(db)
        skip = (page - 1) * per_page
        prs, _ = await repo_db.get_pull_requests(repo_id, skip=skip, limit=per_page)
        return [PullRequestResponse.model_validate(p) for p in prs]

    @staticmethod
    async def get_issues(
        db: AsyncSession, repo_id: int, page: int = 1, per_page: int = 20
    ) -> list[IssueResponse]:
        """Fetch paginated issues for repository."""
        repo_db = RepositoryRepo(db)
        skip = (page - 1) * per_page
        issues, _ = await repo_db.get_issues(repo_id, skip=skip, limit=per_page)
        return [IssueResponse.model_validate(i) for i in issues]

    @staticmethod
    async def delete_repository(
        db: AsyncSession, repo_id: int, user_id: int
    ) -> bool:
        """Delete repository."""
        repo_db = RepositoryRepo(db)
        repo = await repo_db.get(repo_id)
        if not repo:
            raise NotFoundException(detail="Repository not found")
        await repo_db.delete(repo_id)
        await db.commit()
        return True
