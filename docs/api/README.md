# REST API Specification (v1)

Base URL: `http://localhost:8000/api/v1`
Interactive Docs: `http://localhost:8000/docs`

---

## 1. Authentication (`/auth`)

### `POST /auth/register`
Create a new user account.
```json
// Request Body
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "Password123!",
  "full_name": "John Doe"
}

// Response (201 Created)
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer"
}
```

### `POST /auth/login`
Authenticate with email and password.
```json
// Request Body
{
  "email": "user@example.com",
  "password": "Password123!"
}

// Response (200 OK)
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer"
}
```

### `GET /auth/github/authorize`
Get GitHub OAuth authorization URL.
```json
// Response (200 OK)
{
  "authorization_url": "https://github.com/login/oauth/authorize?client_id=..."
}
```

---

## 2. Repositories (`/repositories`)

### `GET /repositories`
List user's tracked repositories (paginated).
- Query params: `page` (default 1), `per_page` (default 20)

### `POST /repositories/import`
Import repository from GitHub.
```json
// Request Body
{
  "github_repo_full_name": "facebook/react"
}
```

### `POST /repositories/{id}/sync`
Trigger manual sync from GitHub for commits, PRs, and issues.

---

## 3. Workflows (`/workflows`)

### `GET /workflows`
List workflow runs.
- Query params: `page`, `per_page`, `status`, `conclusion`, `repo_id`

### `POST /workflows/repository/{repo_id}/sync`
Sync GitHub Actions runs for repository.

### `GET /workflows/deployments`
List deployments across repositories.

---

## 4. Analytics (`/analytics`)

### `GET /analytics/dashboard`
Get high-level aggregated statistics.
```json
// Response (200 OK)
{
  "total_repositories": 5,
  "total_commits": 1420,
  "total_pull_requests": 84,
  "open_issues": 12,
  "successful_builds": 142,
  "failed_builds": 9,
  "build_success_rate": 94.0,
  "total_deployments": 28
}
```

### `GET /analytics/build-trends?days=30`
Get daily success vs failure trends for chart rendering.

---

## 5. Webhooks (`/webhooks`)

### `POST /webhooks/github`
Inbound webhook endpoint for GitHub.
- Requires header: `X-Hub-Signature-256: sha256=<hmac>`
- Requires header: `X-GitHub-Event: <event_name>`
