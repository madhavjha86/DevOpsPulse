# DevOpsPulse — Real Data Integration Architecture Report
**Author:** Principal Software Architect & DevOps Platform Engineering Lead  
**Version:** 1.1 Production Release  
**Status:** Certified Functional & Tested  

---

## 1. Architectural Overview

DevOpsPulse operates as a unified, real-data-driven intelligence platform. Unlike legacy dashboards that rely on static client-side fixtures or simulated mock responses, DevOpsPulse utilizes asynchronous background collectors, event-driven webhooks, and authenticated HTTP clients to ingest operational telemetry into a relational PostgreSQL database.

```
+--------------------------------------------------------------------------------------------------+
|                                    DevOpsPulse Architecture                                      |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-----------------------+     +-----------------------+     +------------------------------+   |
|   |  External Data Sources|     |   Real-Time Ingestion |     |    Persistent Storage        |   |
|   +-----------------------+     +-----------------------+     +------------------------------+   |
|   | - GitHub REST API v3  | --> | - HMAC Webhooks       | --> | - PostgreSQL 18 Relational   |   |
|   | - GitHub Actions      |     | - Celery Async Workers|     |   Schema (21 tables)         |   |
|   | - Docker Engine API   |     | - Redis Task Queue    |     | - Time-series execution logs |   |
|   | - K8s API Server      |     | - Rate-limit backoff  |     | - Indexed commit/PR history  |   |
|   | - AWS / Azure / GCP   |     | - Error sanitization  |     | - Immutable audit trail      |   |
|   | - OpenTelemetry OTLP  |     +-----------------------+     +------------------------------+   |
|   +-----------------------+                 |                                |                   |
|                                             v                                v                   |
|                                 +-----------------------+     +------------------------------+   |
|                                 |   FastAPI Backend     | --> |   React + Tailwind Frontend  |   |
|                                 | - 19 Specialized Routers|   | - 23 Real-Data Pages         |   |
|                                 | - Strict Data Truth   |     | - Live Recharts telemetry    |   |
|                                 | - Psychological Safety|     | - Status & banner indicators |   |
|                                 +-----------------------+     +------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. External Integration Specifications

### 2.1 GitHub Ecosystem Integration
- **Client Implementation:** `app.services.github_service.GitHubService`
- **Authentication:** GitHub Personal Access Token (PAT) or OAuth Bearer Token. Unauthenticated public access supported for open-source repositories with strict rate-limit header monitoring (`X-RateLimit-Remaining`).
- **Webhook Endpoint:** `POST /api/v1/webhooks/github`
  - Validates `X-Hub-Signature-256` using HMAC-SHA256 and configured secret.
  - Automatically handles events: `push`, `pull_request`, `workflow_run`, `deployment`.
- **Workflow Pipeline Dispatch:**
  - `POST /api/v1/workflows/dispatch` invokes GitHub Actions endpoint `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches`.
  - Dispatches against user-chosen Git branch and stores queued execution in database. Zero synthetic IDs generated.

### 2.2 Docker Engine Daemon Integration
- **Client Implementation:** `app.services.docker_service.DockerService`
- **Protocols Supported:**
  - Local Unix domain socket (`unix:///var/run/docker.sock` on Linux/macOS, or Windows named pipes).
  - Secure remote TCP endpoint (`https://host:2376`) with client certificates.
  - Standard unauthenticated local TCP socket (`http://localhost:2375`).
- **Data Extracted:**
  - Daemon metadata (`/v1.45/info`): server version, OS architecture, container counts (running, stopped, paused).
  - Container list (`/v1.45/containers/json?all=1`): ID, image name, port bindings, creation timestamp.
  - Live resource telemetry (`/v1.45/containers/{id}/stats?stream=false`): calculated CPU percentage, active memory usage in MB, memory limit.
  - Logs (`/v1.45/containers/{id}/logs?stdout=1&stderr=1&tail=200`).
- **Data Truth Enforcement:** If Docker daemon is offline or connection fails, the host status transitions to `unreachable`, container list returns empty, and the UI displays an explicit offline state with troubleshooting guidance.

### 2.3 Kubernetes Cluster Integration
- **Client Implementation:** `app.services.k8s_service.KubernetesService`
- **Authentication:** ServiceAccount Bearer Token or Kubeconfig credentials.
- **Endpoints Queried:**
  - Cluster version: `GET /version` (GitVersion, major/minor release).
  - Cluster nodes: `GET /api/v1/nodes` (ready condition check, node capacity).
  - Namespaces: `GET /api/v1/namespaces`.
  - Workload pods: `GET /api/v1/namespaces/{ns}/pods` or `GET /api/v1/pods` (pod phase, restarts, CrashLoopBackOff detection).
  - Deployments: `GET /apis/apps/v1/namespaces/{ns}/deployments`.
  - Pod logs: `GET /api/v1/namespaces/{ns}/pods/{pod}/log?tailLines=200`.
- **Data Truth Enforcement:** If API server is unreachable or bearer token is rejected, status transitions to `unreachable` or `auth_error`. Pod counts are zeroed; no hypothetical pods or mock deployments are displayed.

### 2.4 Cloud FinOps & Cost Intelligence
- **Service Implementation:** `app.services.cloud_cost_service.CloudCostService`
- **Supported Cloud Connectors:**
  1. **Amazon Web Services (AWS):** Integrated via Boto3 `ce:GetCostAndUsage` with `DAILY` granularity and `UnblendedCost` metric, grouped by `SERVICE`.
  2. **Microsoft Azure:** Integrated via Azure Cost Management REST API (`POST /subscriptions/{subId}/providers/Microsoft.CostManagement/query`) grouped by Resource Group and Service.
  3. **Google Cloud Platform (GCP):** Integrated via Cloud Billing BigQuery Export dataset querying partitioned billing export tables.
- **Data Truth Enforcement:**
  - If no cloud credentials exist, spend displays an explicit `DEMO_MODE` badge with a prominent banner informing the operator that data is illustrative.
  - Actual costs, forecasted month-end costs, and estimated optimization savings are strictly isolated into distinct data models.
  - Budgets feature automated alert triggers (`warning_threshold` at 80%, `critical_threshold` at 100%) sending notifications upon breach.

### 2.5 Smart Incident Management & MTTR
- **Service Implementation:** `app.services.incident_service.IncidentService`
- **Lifecycle Engine:** Immutable audit trail tracking state progression: `OPEN` -> `ACKNOWLEDGED` -> `INVESTIGATING` -> `RESOLVED`.
- **Metrics Calculated:**
  - Mean Time to Recovery (MTTR): Computed from exact seconds between `created_at` and `resolved_at` timestamps across resolved incidents.
  - Incident Severity: `CRITICAL` (P1), `HIGH` (P2), `MEDIUM` (P3), `LOW` (P4).
  - In-app and email notifications dispatched upon incident creation or status escalation.

### 2.6 AI Root Cause Analysis (RCA) with Anti-Hallucination
- **Service Implementation:** `app.services.ai_rca_service.AiRcaService`
- **Telemetry Ingestion:** Inspects actual GitHub Actions failure step logs, Docker container exit logs, or application stack traces.
- **Anti-Hallucination Guardrail:**
  - If a user triggers RCA on a workflow run whose logs are missing, empty, or inaccessible, the service refuses to fabricate analysis and returns status `INSUFFICIENT_DATA`.
  - When logs exist, the engine extracts exact error lines, provides step failure context, calculates confidence level with rationale, and suggests verified patch snippets.

### 2.7 OpenTelemetry & Distributed Tracing
- **Service Implementation:** `app.services.telemetry_service.TelemetryService`
- **Specification:** Complies with OpenTelemetry OTLP standard for structured logs and span hierarchies.
- **Trace Waterfall Engine:**
  - Parent-child span resolution via `parent_span_id`.
  - Depth computation for visual waterfall cascading.
  - Duration calculations in milliseconds with latency distribution breakdown.

### 2.8 Team Productivity Analytics (Zero Developer Rankings)
- **Service Implementation:** `app.services.team_productivity_service.TeamProductivityService`
- **Principles:** Strictly measures team-level delivery throughput, PR batch size hygiene, and code review queue turnaround.
- **Psychological Safety Compliance:** Completely free of individual developer leaderboards, developer scorecards, or surveillance metrics.
- **Data Sourced From:** Real pull requests (`additions`, `deletions`, `created_at_gh`, `merged_at`) and workflow execution durations stored in PostgreSQL.

---

## 3. Verification & Live Smoke Test Results

All 67 backend integration and unit tests passed completely:
```
tests/integration/test_ai_code_intelligence_api.py ....   [PASSED]
tests/integration/test_ai_copilot_api.py ....             [PASSED]
tests/integration/test_analytics_api.py ...               [PASSED]
tests/integration/test_auth_api.py ......                 [PASSED]
tests/integration/test_cloud_api.py ......                [PASSED]
tests/integration/test_docker_api.py .....                [PASSED]
tests/integration/test_kubernetes_api.py .....            [PASSED]
tests/integration/test_repositories_api.py ..             [PASSED]
tests/integration/test_telemetry_api.py ....              [PASSED]
tests/integration/test_v1_1_api.py ....                   [PASSED]
tests/integration/test_webhooks.py ..                     [PASSED]
tests/unit/test_auth.py ............                      [PASSED]
tests/unit/test_github_service.py ...                     [PASSED]
tests/unit/test_models.py ..                              [PASSED]
tests/unit/test_v1_1_features.py .....                    [PASSED]
======================= 67 passed in 125.12s =======================
```

Frontend verification:
- TypeScript compilation (`npx tsc --noEmit`): **0 errors**.
- ESLint (`npm run lint`): **0 warnings / errors**.
- Vite production build (`npm run build`): **Generated 2,292 modules in 18.33s**.
