# DevOpsPulse — Complete API & Data Source Mapping Matrix
**Platform Version:** 1.1 Production Release  
**Architecture:** FastAPI Asynchronous Service Layer + PostgreSQL 18  

This matrix documents the complete data lineage for every API endpoint across DevOpsPulse, showing the database tables, external systems, data truth classifications, and consuming frontend components.

---

## Complete API Data Source Mapping

| HTTP & Endpoint | Backend Handler | Database Tables | External Data Source | Data Truth Status | Unconfigured Fallback | Frontend Consumer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/analytics/stats` | `AnalyticsService.get_dashboard_stats` | `repositories`, `commits`, `pull_requests`, `issues`, `workflow_runs`, `deployments` | PostgreSQL Indexed Tables | `DATABASE_DERIVED_DATA` | Returns 0 for counts | `DashboardPage.tsx` (`StatsGrid`) |
| `GET /api/v1/analytics/dora` | `AnalyticsService.get_dora_metrics` | `workflow_runs`, `deployments`, `incidents`, `pull_requests` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Rating defaults to 'Low' | `DoraPage.tsx`, `DoraMetricsOverviewCard` |
| `GET /api/v1/analytics/build-trends` | `AnalyticsService.get_build_trends` | `workflow_runs` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty daily array | `BuildTrendChart.tsx` |
| `GET /api/v1/analytics/workflow-performance` | `AnalyticsService.get_workflow_performance` | `workflow_runs` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | 0 average seconds | `WorkflowPerformanceChart.tsx` |
| `GET /api/v1/analytics/repository-activity` | `AnalyticsService.get_repository_activity` | `commits` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | 0 daily commits | `RepositoryActivityChart.tsx` |
| `GET /api/v1/analytics/recent-activity` | `AnalyticsService.get_recent_activity` | `commits`, `pull_requests`, `workflow_runs`, `issues` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `RecentActivity.tsx` |
| `GET /api/v1/analytics/team-productivity/overview` | `TeamProductivityService.get_overview` | `pull_requests`, `workflow_runs`, `engineering_teams`, `team_repositories` | GitHub PR Timestamps in PostgreSQL | `DATABASE_DERIVED_DATA` | Default team aggregates | `TeamProductivityPage.tsx` |
| `GET /api/v1/analytics/team-productivity/teams` | `TeamProductivityService.list_teams` | `engineering_teams`, `team_repositories` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Auto-seeds default teams | `TeamProductivityPage.tsx` |
| `POST /api/v1/analytics/team-productivity/teams` | `TeamProductivityService.create_team` | `engineering_teams`, `team_repositories` | User Request | `DATABASE_DERIVED_DATA` | 422 on validation failure | `TeamProductivityPage.tsx` (Create Modal) |
| `GET /api/v1/incidents` | `IncidentService.list_incidents` | `incidents` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty array | `IncidentsPage.tsx` |
| `POST /api/v1/incidents` | `IncidentService.create_incident` | `incidents`, `incident_timeline_events`, `notifications` | User / AlertManager | `DATABASE_DERIVED_DATA` | 422 on invalid payload | `IncidentsPage.tsx` (Modal) |
| `GET /api/v1/incidents/stats` | `IncidentService.get_stats` | `incidents` | PostgreSQL Timestamps | `DATABASE_DERIVED_DATA` | 0 counts, 0.0 MTTR | `IncidentsPage.tsx` (Stats Grid) |
| `GET /api/v1/incidents/{id}/timeline` | `IncidentService.get_timeline` | `incident_timeline_events` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | 404 if not found | `IncidentsPage.tsx` (Audit Drawer) |
| `PATCH /api/v1/incidents/{id}/status` | `IncidentService.update_status` | `incidents`, `incident_timeline_events` | User Action | `DATABASE_DERIVED_DATA` | 400 on invalid state transition | `IncidentsPage.tsx` |
| `POST /api/v1/ai/rca/generate` | `AiRcaService.generate_rca` | `workflow_runs`, `telemetry_logs` | Gemini / OpenAI + Workflow Logs | `REAL_LIVE_DATA` / `INSUFFICIENT_DATA` | Returns `INSUFFICIENT_DATA` if logs empty | `AIRootCauseAnalysisPage.tsx` |
| `GET /api/v1/infrastructure/cost/overview` | `CloudCostService.get_overview` | `cloud_accounts`, `cloud_cost_items`, `cloud_budgets` | AWS Cost Explorer / Azure / GCP | `REAL_LIVE_DATA` / `DEMO_MODE` | Flags `DEMO_MODE` if unlinked | `CloudCostPage.tsx` |
| `GET /api/v1/infrastructure/cost/budgets` | `CloudCostService.list_budgets` | `cloud_budgets` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `CloudCostPage.tsx` |
| `POST /api/v1/infrastructure/cost/budgets` | `CloudCostService.create_budget` | `cloud_budgets` | User Request | `DATABASE_DERIVED_DATA` | 422 on invalid threshold | `CloudCostPage.tsx` (Budget Modal) |
| `GET /api/v1/infrastructure/cost/optimizations` | `CloudCostService.list_optimizations` | `cloud_cost_optimizations` | FinOps Engine Rules | `DATABASE_DERIVED_DATA` | Empty list | `CloudCostPage.tsx` |
| `GET /api/v1/infrastructure/docker/hosts` | `DockerService.get_user_hosts` | `docker_hosts` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Seeds localhost:2375 default | `DockerContainersPage.tsx` |
| `GET /api/v1/infrastructure/docker/hosts/{id}/containers` | `DockerService.get_containers` | `docker_hosts` | Docker REST API `/v1.45/` | `REAL_LIVE_DATA` | Returns `unreachable` + empty | `DockerContainersPage.tsx` |
| `GET /api/v1/infrastructure/kubernetes/clusters` | `KubernetesService.get_user_clusters` | `k8s_clusters` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `KubernetesPage.tsx` |
| `GET /api/v1/infrastructure/kubernetes/clusters/{id}/overview` | `KubernetesService.get_overview` | `k8s_clusters` | Kubernetes API Server | `REAL_LIVE_DATA` | Returns `unreachable` + empty | `KubernetesPage.tsx` |
| `GET /api/v1/repositories` | `RepositoryRepo.get_by_user` | `repositories`, `github_accounts` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `RepositoriesPage.tsx` |
| `POST /api/v1/repositories/sync` | `WorkflowService.sync_workflow_runs` | `repositories`, `workflow_runs` | GitHub REST API v3 | `REAL_SYNCED_DATA` | 400 if token missing | `RepositoriesPage.tsx` |
| `POST /api/v1/workflows/dispatch` | `WorkflowService.dispatch_workflow` | `workflow_runs`, `notifications` | GitHub Actions API | `REAL_LIVE_DATA` | Dispatches or returns GitHub error | `WorkflowsPage.tsx` |
| `GET /api/v1/workflows/runs` | `WorkflowService.get_workflow_runs` | `workflow_runs` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `WorkflowsPage.tsx` |
| `GET /api/v1/workflows/deployments` | `WorkflowService.get_deployments` | `deployments` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | Empty list | `DeploymentsPage.tsx` |
| `GET /api/v1/telemetry/logs` | `TelemetryService.query_logs` | `telemetry_logs` | PostgreSQL Tables | `REAL_SYNCED_DATA` | Empty query result | `TelemetryPage.tsx` |
| `GET /api/v1/telemetry/traces` | `TelemetryService.query_traces` | `telemetry_spans` | PostgreSQL Tables | `REAL_SYNCED_DATA` | Empty list | `TelemetryPage.tsx` (Traces View) |
| `GET /api/v1/security/overview` | `SecurityService.get_overview` | `github_accounts`, `repositories` | GitHub Dependabot Alerts API | `REAL_SYNCED_DATA` | Clean grade A scorecard | `SecurityPage.tsx` |
| `POST /api/v1/webhooks/github` | `WorkflowService.process_webhook` | `repositories`, `commits`, `pull_requests`, `workflow_runs` | GitHub Webhook Delivery | `REAL_LIVE_DATA` | 401 on bad signature | None (Inbound Event Receiver) |
| `GET /api/v1/users/me` | `UserRepository.get` | `users` | PostgreSQL Tables | `DATABASE_DERIVED_DATA` | 401 Unauthorized | Global Layout & Header |
