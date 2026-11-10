# System Architecture Specification

## 1. Executive Summary

DevOpsPulse is engineered as a decoupled, multi-tier Developer Productivity & CI/CD Monitoring platform. It delivers real-time repository ingestion, GitHub Actions workflow tracking, time-series metrics calculation, and asynchronous notifications via Celery and Redis.

---

## 2. Component Diagram

```
+-----------------------------------------------------------------+
|                         PRESENTATION LAYER                      |
|  React 18 + TypeScript + Vite + Tailwind CSS + Recharts         |
|  (Responsive dark-mode single-page application)                 |
+-----------------------------------------------------------------+
                                |
                   HTTPS / JSON (REST /api/v1)
                                v
+-----------------------------------------------------------------+
|                         APPLICATION LAYER                       |
|                     FastAPI (Python 3.12+)                      |
|                                                                 |
|   +-----------------------+     +--------------------------+    |
|   | API Routers (/v1)     |     | Middleware               |    |
|   | - Auth / OAuth        |     | - Request Timing Logger  |    |
|   | - Repositories        |     | - Rate Limiter (SlowAPI) |    |
|   | - Workflows           |     | - CORS Whitelist         |    |
|   | - Analytics           |     | - Centralized Exceptions |    |
|   | - Notifications       |     +--------------------------+    |
|   | - Webhooks            |                                     |
|   +-----------------------+                                     |
|               |                                                 |
|               v                                                 |
|   +--------------------------------------------------------+    |
|   | Service Layer (Business Logic & Validation)            |    |
|   | - AuthService, UserService, GitHubService              |    |
|   | - RepositoryService, WorkflowService, AnalyticsService |    |
|   +--------------------------------------------------------+    |
|               |                                                 |
|               v                                                 |
|   +--------------------------------------------------------+    |
|   | Data Access Layer (Repository Pattern)                 |    |
|   | - UserRepository, RepositoryRepo, WorkflowRepo, etc.   |    |
|   +--------------------------------------------------------+    |
+-----------------------------------------------------------------+
             /                            \
            v                              v
+-----------------------+      +-----------------------+
|   PostgreSQL 16 DB    |      |  Redis 7 Cache/Queue  |
|   SQLAlchemy 2.0 ORM  |      |  Celery Task Broker   |
+-----------------------+      +-----------------------+
                                           |
                                           v
                               +-----------------------+
                               |     Celery Worker     |
                               |  - Background Sync    |
                               |  - Alert Dispatch     |
                               +-----------------------+
```

---

## 3. Data Flow

### A. Repository Ingestion
1. User provides repository `owner/repo` through the dashboard.
2. `RepositoryService` fetches metadata via `GitHubService` using the user's stored OAuth token.
3. Record is created in `repositories` table.
4. Background sync fetches the last 30 commits, active pull requests, and issues.
5. GitHub Actions workflow runs are upserted into `workflow_runs`.

### B. Webhook Lifecycle
1. GitHub delivers a webhook event to `/api/v1/webhooks/github`.
2. Signature verification middleware checks `X-Hub-Signature-256` against configured secret using HMAC-SHA256.
3. Event `workflow_run` is decoded: conclusion (`success` or `failure`) triggers automatic notification generation in the database.
4. Client polls or receives notification update in real time.

---

## 4. Database Schema Design

The persistence tier consists of 10 normalized tables with foreign keys and cascade rules:
- `users`: Core credentials, roles, profile details.
- `github_accounts`: OAuth tokens, user linkages, scopes.
- `repositories`: Tracked repositories with statistics.
- `commits`: Commit SHA, author information, timestamps.
- `pull_requests`: PR number, state, title, and dates.
- `issues`: Issue number, status, labels.
- `workflow_runs`: GitHub Actions run IDs, status, conclusion, duration.
- `deployments`: Release environments and references.
- `notifications`: User alert messages and read state.
- `audit_logs`: System access and modification logs.
