"""Repository, Commit, PullRequest, and Issue Pydantic schemas."""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RepositoryResponse(BaseModel):
    """Public repository representation."""

    id: int
    github_id: int
    name: str
    full_name: str
    description: str | None = None
    url: str
    html_url: str
    language: str | None = None
    stars_count: int = 0
    forks_count: int = 0
    open_issues_count: int = 0
    is_private: bool = False
    default_branch: str = "main"
    last_synced_at: datetime | None = None
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class RepositoryListResponse(BaseModel):
    """Paginated list of repositories."""

    repositories: list[RepositoryResponse]
    total: int
    page: int
    per_page: int


class CommitResponse(BaseModel):
    """Public commit representation."""

    id: int
    sha: str
    message: str
    author_name: str
    author_email: str | None = None
    author_date: datetime
    additions: int | None = 0
    deletions: int | None = 0

    model_config = {"from_attributes": True}


class PullRequestResponse(BaseModel):
    """Public pull request representation."""

    id: int
    github_id: int
    number: int
    title: str
    state: str
    author: str | None = None
    url: str | None = None
    created_at_gh: datetime | None = None
    closed_at: datetime | None = None
    merged_at: datetime | None = None
    additions: int | None = 0
    deletions: int | None = 0

    model_config = {"from_attributes": True}


class IssueResponse(BaseModel):
    """Public issue representation."""

    id: int
    github_id: int
    number: int
    title: str
    state: str
    author: str | None = None
    labels: str | None = None
    created_at_gh: datetime | None = None
    closed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ImportRepositoryRequest(BaseModel):
    """Request to import a repository by its full name."""

    github_repo_full_name: str = Field(
        ..., pattern=r"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$"
    )

    @field_validator("github_repo_full_name", mode="before")
    @classmethod
    def sanitize_repo_full_name(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            v = re.sub(r"^https?://(?:www\.)?github\.com/", "", v, flags=re.IGNORECASE)
            v = re.sub(r"^git@github\.com:", "", v, flags=re.IGNORECASE)
            v = re.sub(r"\.git$", "", v, flags=re.IGNORECASE)
            v = v.strip("/")
        return v

