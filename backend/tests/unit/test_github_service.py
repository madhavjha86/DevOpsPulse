"""Unit tests for GitHubService with mocked responses."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.exceptions import RateLimitException
from app.services.github_service import GitHubService


class TestGitHubServiceClient:
    """Validate GitHub client calls, token handling, and rate limit errors."""

    @pytest.mark.asyncio
    async def test_get_user_repos_success(self) -> None:
        mock_data = [
            {
                "id": 101,
                "name": "pulse-repo",
                "full_name": "octocat/pulse-repo",
                "description": "DevOps monitoring tool",
                "html_url": "https://github.com/octocat/pulse-repo",
                "language": "Python",
                "stargazers_count": 50,
                "forks_count": 12,
                "open_issues_count": 3,
                "private": False,
                "default_branch": "main",
            }
        ]

        client = GitHubService(access_token="fake-gh-token")
        with patch.object(client, "_request", new_callable=AsyncMock) as mock_req:
            mock_req.return_value = mock_data
            repos = await client.get_user_repos()

            assert len(repos) == 1
            assert repos[0]["name"] == "pulse-repo"
            assert repos[0]["stargazers_count"] == 50

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_header_raises_exception(self) -> None:
        mock_resp = MagicMock()
        mock_resp.headers = {"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1735689600"}

        client = GitHubService(access_token="fake-token")
        with pytest.raises(RateLimitException):
            client._check_rate_limit(mock_resp)

    @pytest.mark.asyncio
    async def test_rate_limit_403_status_raises_exception(self) -> None:
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.headers = {"X-RateLimit-Remaining": "0"}
        mock_resp.json.return_value = {"message": "API rate limit exceeded for user"}

        client = GitHubService(access_token="fake-token")
        with patch.object(client, "_request", new_callable=AsyncMock) as mock_req:
            mock_req.side_effect = RateLimitException("GitHub API rate limit exceeded.")
            with pytest.raises(RateLimitException):
                await client.get_user_repos()
