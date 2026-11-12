# DevOpsPulse — Multi-Tenant RBAC Permission Matrix

This document defines the authoritative access control matrix for DevOpsPulse across all six supported user roles and tenant boundaries.

---

## 1. Role Definitions

| Role | Hierarchy / Description | Primary Authority Scope |
|---|---|---|
| **SUPER_ADMIN** | Platform Administrator with root-level privileges | All organizations, system users, global telemetry, and workspace management. |
| **ORGANIZATION_ADMIN** | Tenant Workspace Owner / Administrator | Full control within their designated organization: invite members, assign roles, configure cloud accounts & billing. |
| **DEVOPS_ENGINEER** | Operations, SRE, and Infrastructure Lead | CI/CD pipelines, Docker hosts, Kubernetes clusters, telemetry, and cost optimization execution. |
| **DEVELOPER** | Software Engineer / Contributor | Repositories, branches, commits, pull requests, AI code intelligence, and incident bug reporting. |
| **SECURITY_ENGINEER** | Application Security & Compliance Specialist | Security posture scorecard, vulnerability CVE triage, secret leak detection, and on-demand security scans. |
| **VIEWER** | Stakeholder / Auditor (Read-Only) | Read-only access to all dashboards, analytics, reports, repositories, and active monitors. Mutations strictly forbidden. |

---

## 2. Exhaustive Permission Matrix

| Module / Resource | HTTP Method | Endpoint Path | SUPER_ADMIN | ORG_ADMIN | DEVOPS | DEVELOPER | SECURITY | VIEWER |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Authentication** | POST | `/api/v1/auth/login` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Authentication** | POST | `/api/v1/auth/refresh` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Workspaces** | GET | `/api/v1/organizations` | Allow (All) | Allow (Owned) | Allow (Enrolled) | Allow (Enrolled) | Allow (Enrolled) | Allow (Enrolled) |
| **Workspaces** | POST | `/api/v1/organizations` | Allow | Allow | Allow | Allow | Allow | Deny (403) |
| **Workspaces** | GET | `/api/v1/organizations/{id}` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Workspace Members** | GET | `/api/v1/organizations/{id}/members` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Workspace Members** | PUT | `/api/v1/organizations/{id}/members/{u_id}/role` | Allow (Any) | Allow (Tenant) | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Workspace Members** | DELETE | `/api/v1/organizations/{id}/members/{u_id}` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Invitations** | POST | `/api/v1/organizations/{id}/invitations` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Invitations** | GET | `/api/v1/organizations/{id}/invitations` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Repositories** | GET | `/api/v1/repositories` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Repositories** | POST | `/api/v1/repositories/import` | Allow | Allow | Allow | Allow | Allow | Deny (403) |
| **Repositories** | DELETE | `/api/v1/repositories/{id}` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Repositories** | GET | `/api/v1/repositories/{id}/commits` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Repositories** | GET | `/api/v1/repositories/{id}/pulls` | Allow | Allow | Allow | Allow | Allow | Allow |
| **CI/CD Pipelines** | GET | `/api/v1/workflows` | Allow | Allow | Allow | Allow | Allow | Allow |
| **CI/CD Pipelines** | POST | `/api/v1/workflows/dispatch` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Docker** | GET | `/api/v1/infrastructure/docker/hosts` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Infrastructure / Docker** | POST | `/api/v1/infrastructure/docker/hosts` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Docker** | PUT | `/api/v1/infrastructure/docker/hosts/{id}` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Docker** | DELETE | `/api/v1/infrastructure/docker/hosts/{id}` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Docker** | POST | `/api/v1/infrastructure/docker/hosts/{id}/containers/{cid}/action` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / K8s** | GET | `/api/v1/infrastructure/k8s/clusters` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Infrastructure / K8s** | POST | `/api/v1/infrastructure/k8s/clusters` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / K8s** | PUT | `/api/v1/infrastructure/k8s/clusters/{id}` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / K8s** | DELETE | `/api/v1/infrastructure/k8s/clusters/{id}` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / K8s** | POST | `/api/v1/infrastructure/k8s/clusters/{id}/deployments/{d}/scale` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Cloud** | GET | `/api/v1/infrastructure/cloud/accounts` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Infrastructure / Cloud** | POST | `/api/v1/infrastructure/cloud/accounts` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Infrastructure / Cloud** | DELETE | `/api/v1/infrastructure/cloud/accounts/{id}` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Cloud FinOps** | GET | `/api/v1/cloud/cost/overview` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Cloud FinOps** | POST | `/api/v1/cloud/cost/budgets` | Allow | Allow | Deny (403) | Deny (403) | Deny (403) | Deny (403) |
| **Cloud FinOps** | POST | `/api/v1/cloud/cost/optimizations/{id}/apply` | Allow | Allow | Allow | Deny (403) | Deny (403) | Deny (403) |
| **Observability & Logs** | GET | `/api/v1/telemetry/spans` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Security Hub** | GET | `/api/v1/security/overview` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Security Hub** | POST | `/api/v1/security/scan` | Allow | Allow | Deny (403) | Deny (403) | Allow | Deny (403) |
| **Incidents** | GET | `/api/v1/incidents` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Incidents** | POST | `/api/v1/incidents` | Allow | Allow | Allow | Allow | Allow | Deny (403) |
| **Incidents** | PUT | `/api/v1/incidents/{id}/status` | Allow | Allow | Allow | Allow | Allow | Deny (403) |
| **Analytics (DORA)** | GET | `/api/v1/analytics/dora` | Allow | Allow | Allow | Allow | Allow | Allow |
| **Team Productivity** | GET | `/api/v1/analytics/team-productivity/overview` | Allow | Allow | Allow | Allow | Allow | Allow |

---

## 3. Privilege Escalation Prevention Rules
1. **SUPER_ADMIN Protection**: Only a platform administrator with `is_superuser=True` can assign or invite members with the `SUPER_ADMIN` role. Any `ORGANIZATION_ADMIN` attempting this receives `403 Forbidden`.
2. **Self-Promotion Denial**: Users cannot elevate their own roles (`PUT /api/v1/organizations/{id}/members/{id}/role` requires `ORGANIZATION_ADMIN` or `SUPER_ADMIN`).
3. **Cross-Tenant Barrier**: A user belonging to Organization A cannot access resources in Organization B. Specifying a foreign `X-Organization-Id` returns `403 Forbidden ("Cross-tenant access denied")`.
4. **Read-Only Lockout (VIEWER)**: All HTTP mutations (`POST`, `PUT`, `DELETE`, `PATCH`) triggered by a `VIEWER` account are trapped and rejected with `403 Forbidden ("Viewer role is read-only. Mutation operations are prohibited.")`.
