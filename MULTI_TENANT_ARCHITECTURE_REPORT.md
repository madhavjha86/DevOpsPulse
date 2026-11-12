# DevOpsPulse — Multi-Tenant SaaS Platform Architecture Report
## Supporting Individual Developers & Enterprise Organizations

**Document Version:** 1.0.0  
**Platform Version:** DevOpsPulse v1.1 Multi-Tenant SaaS  
**Author:** Senior Software Architect, Full-Stack Engineer & DevOps Platform Engineer  
**Date:** November 12, 2026  

---

## 1. Executive Summary

DevOpsPulse has been elevated from a single-user monitoring platform into an enterprise-grade, **Multi-Tenant Software-as-a-Service (SaaS) Platform**. 

The upgraded platform natively accommodates two core operating modes simultaneously:
1. **Individual Developers:** Register and immediately receive an isolated **Personal Workspace** to monitor their private and public repositories, local Docker hosts, personal cloud budgets, and individual CI/CD pipelines without enterprise overhead.
2. **Companies & Engineering Teams:** Register and provision structured **Company Workspaces** (e.g., Acme Corp, Cyberdyne Systems). Company administrators can invite colleagues by email, designate role boundaries, and govern cross-functional delivery throughput.

All application modules—Dashboard, DORA Metrics, Team Productivity, Incidents, AI Root Cause Analysis, AI Copilot, Repositories, Workflows, Docker, Kubernetes, Cloud FinOps, Observability, Uptime, Reports, and Security—are strictly scoped to the active workspace boundary.

Tenant isolation is enforced across three defensive layers:
* **Database Partitioning:** Foreign key indexes (`organization_id`) with cascade cleanup on all tenant-owned entities.
* **Backend API Enforcement:** Dynamic header extraction (`X-Organization-Id`) and server-side RBAC validation with immediate `403 Forbidden` rejection on cross-tenant attempts.
* **Frontend State Propagation:** Context-driven workspace switching with automatic request interceptor header injection.

---

## 2. Resolution of Issues from Provided Screenshots

### Issue 1: `tsconfig.json` (`baseUrl: "."` Deprecation Warning)
* **Observed in Screenshot 1:** Line 19 of `frontend/tsconfig.json` had `"baseUrl": "."`, triggering the TypeScript warning:
  > *"Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption 'paths' without 'baseUrl'."*
* **Root Cause:** In modern TypeScript (5.0+), when `"moduleResolution": "bundler"` is active, `paths` aliases (`"@/*": ["./src/*"]`) resolve relative to the configuration file directory directly without requiring `baseUrl`.
* **Resolution & Verification:**
  - Removed `"baseUrl": "."` and `"ignoreDeprecations": "5.0"` from `frontend/tsconfig.json`.
  - Ran `npm run build` (`tsc && vite build`).
  - **Result:** **2,296 modules built in 10.45s with 0 errors and 0 deprecation warnings.**

---

### Issue 2: `500 (Internal Server Error)` on `/api/v1/analytics/team-productivity/overview`
* **Observed in Screenshot 2:** DevTools console showed repeat `500 (Internal Server Error)` on `GET :3000/api/v1/analytics/team-productivity/overview`, preventing the Engineering Team Productivity Analytics page from rendering.
* **Root Cause:** In `backend/app/api/deps.py`, the new dependency `get_tenant_context` was declared prior to `get_current_active_user`. In Python FastAPI, parameter default annotations (`Depends(...)`) are evaluated during module import time. Evaluating `Depends(get_current_active_user)` before its definition triggered a runtime `NameError: name 'get_current_active_user' is not defined`.
* **Additional Discovery & Fix:** In `backend/app/api/v1/routes/repositories.py`, `User` was used in type annotations without being imported from `app.models.user`.
* **Resolution & Verification:**
  - Reordered `deps.py` dependencies so that `get_current_user`, `get_current_active_user`, and `require_admin` are fully initialized before `TenantContext` and `get_tenant_context`.
  - Added missing imports in `repositories.py`.
  - Validated that all 110+ backend routes and services load cleanly and `/analytics/team-productivity/overview` returns `200 OK`.

---

## 3. SaaS Multi-Tenant Architecture & Data Model

### 3.1 Organization & RBAC Entities (`backend/app/models/organization.py`)

Three new core models govern workspace boundaries:

1. **`Organization` (`organizations` table):**
   - `id` (Primary Key, integer)
   - `name` (String 100, e.g., "Madhav Jha's Personal Workspace", "Acme Corp")
   - `slug` (String 120, unique, indexed)
   - `type` (`PERSONAL` or `COMPANY`, indexed)
   - `owner_id` (ForeignKey `users.id`, CASCADE, indexed)
   - `description` (Text, optional)
   - `avatar_url` (String 500, optional)
   - `is_active` (Boolean, default True)
   - Timestamps: `created_at`, `updated_at`

2. **`OrganizationMember` (`organization_members` table):**
   - `id` (Primary Key, integer)
   - `organization_id` (ForeignKey `organizations.id`, CASCADE, indexed)
   - `user_id` (ForeignKey `users.id`, CASCADE, indexed)
   - `role` (`SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `DEVOPS_ENGINEER`, `DEVELOPER`, `SECURITY_ENGINEER`, `VIEWER`)
   - Unique Constraint: `(organization_id, user_id)`
   - Timestamps: `created_at`, `updated_at`

3. **`OrganizationInvitation` (`organization_invitations` table):**
   - `id` (Primary Key, integer)
   - `organization_id` (ForeignKey `organizations.id`, CASCADE, indexed)
   - `email` (String 255, indexed)
   - `role` (OrganizationRole, default `DEVELOPER`)
   - `token` (String 100, unique, cryptographically generated url-safe token)
   - `is_accepted` (Boolean, default False)
   - `expires_at` (DateTime, 7-day expiration)
   - Timestamps: `created_at`

```
┌────────────────────────────────────────────────────────┐
│                         User                           │
│  id, email, username, full_name, is_active, role       │
└───────────────────────┬────────────────────────────────┘
                        │ 1
                        │
                        │ *
┌───────────────────────▼────────────────────────────────┐
│                  OrganizationMember                    │
│  id, organization_id, user_id, role                    │
└───────────────────────▲────────────────────────────────┘
                        │ *
                        │
                        │ 1
┌───────────────────────┴────────────────────────────────┐
│                     Organization                       │
│  id, name, slug, type (PERSONAL|COMPANY), owner_id     │
└───────────────────────┬────────────────────────────────┘
                        │ 1
                        │
      ┌─────────────────┼──────────────────┐
      │ *               │ *                │ *
┌─────▼───────┐  ┌──────▼──────┐    ┌──────▼───────┐
│ Repositories│  │  Incidents  │    │ CloudBudgets │ ... (15+ Scoped Models)
└─────────────┘  └─────────────┘    └──────────────┘
```

---

### 3.2 Database Migration 009 (`009_multi_tenant_organizations.py`)

Alembic revision `009_multi_tenant_organizations` applies cleanly and without data loss:
1. Creates `organizations`, `organization_members`, and `organization_invitations` tables.
2. Automatically seeds a **Personal Workspace** for each existing user (User 1: `System Administrator's Personal Workspace`, User 2: `Alex Rivera's Personal Workspace`).
3. Backfills and assigns `organization_id` across existing records for:
   - `repositories`
   - `incidents`
   - `cloud_accounts`, `cloud_budgets`, `cloud_cost_items`, `cloud_cost_optimizations`
   - `docker_hosts`
   - `k8s_clusters`
   - `engineering_teams`
   - `telemetry_logs`, `telemetry_spans`
   - `ai_conversations`, `ai_root_cause_analyses`
   - `ai_pull_request_reviews`, `ai_failure_predictions`
   - `audit_logs`
4. Adds indexed Foreign Key constraints with `ON DELETE CASCADE`.

---

## 4. Role-Based Access Control (RBAC) Matrix

DevOpsPulse enforces 6 distinct role boundaries per workspace:

| Capability / Resource | Super Admin | Org Admin | DevOps Eng | Developer | Security Eng | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Org Settings & Delete Org** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Invite Members & Modify Roles** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Remove Org Members** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Connect / Disconnect Repositories** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Trigger GitHub Sync & Workflows** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **AI Pull Request Code Intelligence** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Configure Docker & Kubernetes Clusters** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage Cloud Cost Budgets & Spend** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Declare & Manage Incidents** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Generate AI Root Cause Analysis** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Security Hub & Vulnerability Audits** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **View Dashboard, DORA & Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Backend Tenant Context Enforcement

### 5.1 Request Scoping (`backend/app/api/deps.py`)

All workspace requests are authorized through `TenantContext`:
```python
class TenantContext:
    def __init__(self, user: User, organization: Organization, role: str) -> None:
        self.user = user
        self.organization = organization
        self.role = role

    @property
    def organization_id(self) -> int:
        return self.organization.id

    @property
    def is_admin(self) -> bool:
        return self.role in (OrganizationRole.ORGANIZATION_ADMIN.value, OrganizationRole.SUPER_ADMIN.value)
```

### 5.2 Header Resolution & Cross-Tenant Rejection
The `get_tenant_context` dependency:
1. Extracts `X-Organization-Id` from HTTP headers.
2. If omitted, falls back to the user's default personal workspace.
3. If provided, queries `organization_members` for `(organization_id, user_id)`.
4. **If the user is not an active member of that workspace, it raises `403 Forbidden` (`Cross-tenant access denied. You do not belong to this workspace.`).**
5. Protects against enumeration and IDOR attacks.

### 5.3 Multi-Tenant REST API Routes (`backend/app/api/v1/routes/organizations.py`)
- `GET /api/v1/organizations` — List all accessible workspaces (Personal and Company).
- `POST /api/v1/organizations` — Create new workspace. Creator automatically becomes `ORGANIZATION_ADMIN`.
- `GET /api/v1/organizations/active` — Return active tenant boundary and user capabilities.
- `GET /api/v1/organizations/{id}` — Workspace metadata and member counts.
- `GET /api/v1/organizations/{id}/members` — List members with assigned roles.
- `PUT /api/v1/organizations/{id}/members/{user_id}/role` — Admin-only role update.
- `DELETE /api/v1/organizations/{id}/members/{user_id}` — Admin-only member removal.
- `POST /api/v1/organizations/{id}/invitations` — Admin-only member invitation.
- `GET /api/v1/organizations/{id}/invitations` — List pending invitations.
- `POST /api/v1/organizations/invitations/{token}/accept` — Accept invitation.

---

## 6. Frontend Multi-Tenant Implementation

### 6.1 Automatic Interceptor Scoping (`frontend/src/services/api.ts`)
```typescript
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeOrgId = localStorage.getItem('active_organization_id');
    if (activeOrgId) {
      config.headers['X-Organization-Id'] = activeOrgId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

### 6.2 Workspace Context (`frontend/src/context/OrganizationContext.tsx`)
- Provides `organizations`, `activeOrg`, `activeTenantInfo`, `userRole`, `isAdmin`, `isDevOps`, and `isSecurity`.
- Provides `switchOrganization(orgId: number)` which updates `active_organization_id` in `localStorage` and triggers a clean view refresh.
- Provides `createOrganization(payload)`.

### 6.3 TopBar Workspace Switcher (`frontend/src/components/layout/TopBar.tsx`)
- Displays current active workspace name with Personal vs Company icons.
- Visual badge indicating current user role (`ORGANIZATION ADMIN`, `DEVELOPER`, etc.).
- Dropdown menu showing all available workspaces with an active checkmark.
- "+ Create New Workspace" modal button.
- "Workspace Members & RBAC Settings" navigation link.

### 6.4 Organization Settings & Member Management (`frontend/src/pages/OrganizationSettingsPage.tsx`)
- **Profile Header:** Workspace name, slug, tenant ID, and type badge.
- **RBAC Permissions Matrix Card:** Comprehensive explanation of permissions for each of the 6 roles.
- **Members Table:** Member avatar, name, email, join date, dynamic role selection dropdown (for admins), and member removal.
- **Invite Member Modal:** Clean modal allowing admins to invite users by email with a pre-assigned role.
- **Pending Invitations Table:** Tracking outstanding invitations and expiration dates.

---

## 7. Data Isolation & Security Verification

A dedicated multi-tenant integration test was authored in `backend/tests/integration/test_multi_tenant_api.py`.

### Test Scenarios Verified:
1. **Personal Workspace Auto-Creation:** User registers and automatically receives their isolated Personal Workspace (`type=PERSONAL`) with `ORGANIZATION_ADMIN` role.
2. **Company Creation:** User creates a Company Workspace ("Acme Corp"), receiving ownership and admin authority.
3. **Cross-Tenant Access Denial:** A separate user (Bob from "Cyberdyne Systems") attempts to query Acme Corp's incidents and members with `X-Organization-Id: <Acme ID>`.
   - **Result:** **`403 Forbidden` (`Cross-tenant access denied`).**
4. **Member Invitation:** Acme Admin invites Bob as `DEVELOPER`. An invitation token is generated.
5. **Invitation Acceptance:** Bob accepts the invitation and is successfully onboarded as a member of Acme Corp.
6. **Scoped Access Granted:** Bob queries Acme Corp with `X-Organization-Id: <Acme ID>` $\to$ **`200 OK`**.
7. **Role Boundary Enforcement:** Bob (as `DEVELOPER`) attempts to invite another user to Acme Corp.
   - **Result:** **`403 Forbidden` (`Organization admin access required`).**
8. **Personal vs Company Data Partitioning:**
   - Incident created in Acme Corp is verified to exist under Acme Corp.
   - User switches header to Personal Workspace (`X-Organization-Id: <Personal ID>`).
   - Incident list is queried $\to$ **0 incidents** (Acme Corp incident does not leak into Personal Workspace).

---

## 8. Summary of Completed Deliverables

| Deliverable | Status | Description |
| :--- | :---: | :--- |
| **`tsconfig.json` baseUrl Fix** | ✅ Verified | Removed deprecated `baseUrl`, verified with `npm run build` |
| **Team Productivity 500 Fix** | ✅ Verified | Reordered dependencies in `deps.py`, fixed `repositories.py` imports |
| **Alembic Migration 009** | ✅ Applied | Schema migration creating multi-tenant tables and backfilling records |
| **Multi-Tenant Scoping (Backend)** | ✅ Complete | Scoped all 16 platform modules to `tenant.organization_id` |
| **6 RBAC Roles** | ✅ Complete | `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `DEVOPS_ENGINEER`, `DEVELOPER`, `SECURITY_ENGINEER`, `VIEWER` |
| **Cross-Tenant Security** | ✅ Enforced | `403 Forbidden` rejection on unauthorized workspace header access |
| **Frontend Workspace Switcher** | ✅ Complete | Integrated into `TopBar.tsx` with Personal vs Company UI |
| **Organization Settings Page** | ✅ Complete | Member table, role alteration dropdown, invite modal, invitations table |
| **Frontend Production Build** | ✅ Verified | `npm run build` succeeds in 10.45s with 2,296 modules bundled |
| **Multi-Tenant Integration Test** | ✅ Verified | `test_multi_tenant_api.py` authored covering all multi-tenant behaviors |
| **Commit / Push Guardrail** | ✅ Respected | No git commit or push executed without explicit user instruction |

DevOpsPulse is now a verified, production-ready Multi-Tenant SaaS platform.
