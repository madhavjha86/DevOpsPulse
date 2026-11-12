"""GitHub REST API integration client with rate limit handling and retry logic."""

from typing import Any
import httpx

from app.core.config import get_settings
from app.core.exceptions import GitHubAPIException, NotFoundException, RateLimitException
from app.core.logging import get_logger

logger = get_logger("github_service")
settings = get_settings()


class GitHubService:
    """Async client communicating directly with the official GitHub REST API v3."""

    def __init__(self, access_token: str | None = None) -> None:
        self.access_token = access_token
        self.base_url = settings.GITHUB_API_BASE_URL.rstrip("/")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": f"{settings.APP_NAME}-Integration",
        }
        if (
            self.access_token
            and not self.access_token.startswith("ghp_demo_")
            and not self.access_token.startswith("demo_")
            and self.access_token not in ("public_viewer", "none")
        ):
            self.headers["Authorization"] = f"Bearer {self.access_token}"

    def _check_rate_limit(self, response: httpx.Response) -> None:
        """Inspect GitHub rate-limiting headers and raise on exhaustion."""
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset_time = response.headers.get("X-RateLimit-Reset")
        if remaining is not None and int(remaining) <= 0:
            logger.warning(
                "GitHub API rate limit exhausted",
                reset=reset_time,
                remaining=remaining,
            )
            raise RateLimitException(
                detail="GitHub API rate limit exceeded. Please wait before retrying."
            )

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
    ) -> Any:
        """Execute HTTP request with authentication and error handling."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    params=params,
                    json=json_data,
                )
            except httpx.RequestError as exc:
                logger.error("GitHub request connection error", error=str(exc), url=url)
                raise GitHubAPIException(detail=f"Network error communicating with GitHub: {exc}")

            self._check_rate_limit(response)

            if response.status_code == 404:
                raise NotFoundException(detail="GitHub resource not found")
            if response.status_code == 401:
                # If an invalid/expired token was sent, retry as unauthenticated public request
                if "Authorization" in self.headers:
                    unauth_headers = {k: v for k, v in self.headers.items() if k != "Authorization"}
                    retry_resp = await client.request(
                        method=method,
                        url=url,
                        headers=unauth_headers,
                        params=params,
                        json=json_data,
                    )
                    if retry_resp.status_code == 200:
                        return retry_resp.json()
                raise GitHubAPIException(detail="Invalid or expired GitHub access token")
            if response.status_code == 403:
                # May be rate limited or forbidden scope
                msg = response.json().get("message", "Forbidden")
                if "rate limit" in msg.lower():
                    raise RateLimitException(detail="GitHub API rate limit exceeded.")
                raise GitHubAPIException(detail=f"GitHub permission error: {msg}")
            if response.status_code >= 400:
                msg = response.text
                try:
                    msg = response.json().get("message", msg)
                except Exception:
                    pass
                raise GitHubAPIException(detail=f"GitHub API error ({response.status_code}): {msg}")

            if response.status_code == 204 or not response.content:
                return {}

            return response.json()

    async def get_user_info(self) -> dict[str, Any]:
        """Fetch current authenticated user profile."""
        return await self._request("GET", "/user")

    async def get_user_repos(
        self, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch repositories accessible to the authenticated user."""
        params = {
            "page": page,
            "per_page": per_page,
            "sort": "updated",
            "direction": "desc",
        }
        res = await self._request("GET", "/user/repos", params=params)
        return res if isinstance(res, list) else []

    async def get_repo(self, owner: str, repo: str) -> dict[str, Any]:
        """Fetch repository details by owner and repo name."""
        return await self._request("GET", f"/repos/{owner}/{repo}")

    async def get_commits(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch repository commit history."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/commits", params=params)
        return res if isinstance(res, list) else []

    async def get_pull_requests(
        self,
        owner: str,
        repo: str,
        state: str = "all",
        page: int = 1,
        per_page: int = 30,
    ) -> list[dict[str, Any]]:
        """Fetch pull requests for repository."""
        params = {"state": state, "page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/pulls", params=params)
        return res if isinstance(res, list) else []

    async def get_issues(
        self,
        owner: str,
        repo: str,
        state: str = "all",
        page: int = 1,
        per_page: int = 30,
    ) -> list[dict[str, Any]]:
        """Fetch issues for repository (excluding pull requests)."""
        params = {"state": state, "page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/issues", params=params)
        if isinstance(res, list):
            # GitHub issues endpoint includes PRs unless filtered
            return [issue for issue in res if "pull_request" not in issue]
        return []

    async def get_workflow_runs(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch GitHub Actions workflow runs for repository."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/actions/runs", params=params)
        if isinstance(res, dict):
            return res.get("workflow_runs", [])
        return []

    async def get_deployments(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch deployments for repository."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/deployments", params=params)
        return res if isinstance(res, list) else []

    async def dispatch_workflow(
        self,
        owner: str,
        repo: str,
        workflow_id_or_name: str | int,
        ref: str = "main",
        inputs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Trigger an on-demand CI/CD GitHub Actions workflow_dispatch event."""
        payload: dict[str, Any] = {"ref": ref}
        if inputs:
            payload["inputs"] = inputs
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/actions/workflows/{workflow_id_or_name}/dispatches",
            json_data=payload,
        )

    async def get_branches(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch branches for repository."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/branches", params=params)
        return res if isinstance(res, list) else []

    async def get_contributors(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch contributors for repository."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/contributors", params=params)
        return res if isinstance(res, list) else []

    async def get_releases(
        self, owner: str, repo: str, page: int = 1, per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch releases for repository."""
        params = {"page": page, "per_page": per_page}
        res = await self._request("GET", f"/repos/{owner}/{repo}/releases", params=params)
        return res if isinstance(res, list) else []

    async def get_dependabot_alerts(
        self, owner: str, repo: str, state: str = "open", per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch real GitHub Dependabot security alerts for repository."""
        params = {"state": state, "per_page": per_page}
        try:
            res = await self._request("GET", f"/repos/{owner}/{repo}/dependabot/alerts", params=params)
            return res if isinstance(res, list) else []
        except Exception:
            return []
