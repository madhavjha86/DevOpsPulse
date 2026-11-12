# DevOpsPulse — Role-Based Test Accounts & Workspace Provisioning Report

## 1. Executive Summary
DevOpsPulse has been enhanced with a robust, enterprise-grade multi-tenant Role-Based Access Control (RBAC) foundation supporting six dedicated permanent roles. Each role is represented by a permanent user record in PostgreSQL 18, equipped with cryptographically secure bcrypt password hashing, dedicated personal workspaces, and structured memberships within the company workspace **"DevOpsPulse Test Organization"**.

All six user accounts are verified to log in successfully, generate valid JWT access and refresh tokens, and strictly obey their permission boundaries enforced at the FastAPI dependency and database query levels.

---

## 2. Permanent Role-Based Accounts Architecture

| User ID | Role | Email | Username | Display Name | Workspace Role | Personal Workspace | Superuser Override |
|---|---|---|---|---|---|---|---|
| **1** | `SUPER_ADMIN` | `admin@devopspulse.com` | `admin` | System Administrator | `SUPER_ADMIN` | `personal-1` (ID: 1) | **Yes** (`is_superuser=True`) |
| **3** | `ORGANIZATION_ADMIN` | `orgadmin@devopspulse.local` | `orgadmin` | Organization Admin | `ORGANIZATION_ADMIN` (Owner) | `personal-orgadmin` (ID: 3) | **No** (`is_superuser=False`) |
| **4** | `DEVOPS_ENGINEER` | `devops@devopspulse.local` | `devops` | DevOps Engineer | `DEVOPS_ENGINEER` | `personal-devops` (ID: 4) | **No** (`is_superuser=False`) |
| **2** | `DEVELOPER` | `developer@company.com` | `developer` | Alex Rivera | `DEVELOPER` | `personal-2` (ID: 2) | **No** (`is_superuser=False`) |
| **5** | `SECURITY_ENGINEER` | `security@devopspulse.local` | `security` | Security Engineer | `SECURITY_ENGINEER` | `personal-security` (ID: 5) | **No** (`is_superuser=False`) |
| **6** | `VIEWER` | `viewer@devopspulse.local` | `viewer` | Viewer User | `VIEWER` | `personal-viewer` (ID: 6) | **No** (`is_superuser=False`) |

> **Password Retention & Privacy Note**:
> Existing accounts `admin@devopspulse.com` and `developer@company.com` have their existing passwords strictly preserved. All credentials for local testing are saved in the local-only, git-ignored `TEST_ACCOUNTS_LOCAL.md`.

---

## 3. Workspaces & Tenant Topologies

### A. Shared Company Workspace: "DevOpsPulse Test Organization"
- **Database ID**: `7`
- **Slug**: `devopspulse-test-org`
- **Workspace Type**: `COMPANY`
- **Owner**: `orgadmin@devopspulse.local` (User ID: 3)
- **Primary Tracked Repository**: `madhavjha86/DevOpsPulse` (Repo ID: 5)
- **Active Members**:
  - `admin@devopspulse.com` (`SUPER_ADMIN`)
  - `orgadmin@devopspulse.local` (`ORGANIZATION_ADMIN`)
  - `devops@devopspulse.local` (`DEVOPS_ENGINEER`)
  - `developer@company.com` (`DEVELOPER`)
  - `security@devopspulse.local` (`SECURITY_ENGINEER`)
  - `viewer@devopspulse.local` (`VIEWER`)

### B. Isolated Verification Workspace: "Acme Global Corp"
- **Database ID**: `8`
- **Slug**: `acme-global-corp`
- **Workspace Type**: `COMPANY`
- **Owner**: `admin@devopspulse.com` (User ID: 1)
- **Enrolled Members**: Only User ID 1 (`admin@devopspulse.com`).
- **Security Purpose**: Acts as an isolated external organization for automated cross-tenant boundary and IDOR prevention verification.

### C. Developer Personal Workspaces
Each user possesses an isolated individual workspace:
1. `System Administrator's Personal Workspace` (Slug: `personal-1`, Owner: User 1)
2. `Alex Rivera's Personal Workspace` (Slug: `personal-2`, Owner: User 2)
3. `Organization Admin's Personal Workspace` (Slug: `personal-orgadmin`, Owner: User 3)
4. `DevOps Engineer's Personal Workspace` (Slug: `personal-devops`, Owner: User 4)
5. `Security Engineer's Personal Workspace` (Slug: `personal-security`, Owner: User 5)
6. `Viewer User's Personal Workspace` (Slug: `personal-viewer`, Owner: User 6)

---

## 4. Authentication and Token Mechanics
- **Token Type**: Stateless Bearer JWT (`HS256`).
- **Expiration**: 30 minutes for access tokens; 7 days for refresh tokens.
- **Payload Schema**:
  ```json
  {
    "sub": "4",
    "iat": 1794511812,
    "exp": 1794513612,
    "type": "access"
  }
  ```
- **Tenant Context Resolution**:
  Passed via HTTP header `X-Organization-Id: <id>`. Resolved by `get_tenant_context` dependency in `app/api/deps.py`:
  1. If `user.is_superuser`, access is granted globally with `SUPER_ADMIN` privileges.
  2. If user is a verified member of the requested organization ID, their explicit role within that workspace (`ORGANIZATION_ADMIN`, `DEVOPS_ENGINEER`, `DEVELOPER`, `SECURITY_ENGINEER`, `VIEWER`) is loaded.
  3. If user is NOT a member of the requested organization ID, the request is immediately rejected with `403 Forbidden` ("Cross-tenant access denied").
  4. If `X-Organization-Id` is omitted, the user's primary company workspace or personal workspace is used as default.

---

## 5. Verification Status
- **PostgreSQL 18 Account Persistence**: Verified and permanent.
- **API Login Endpoint (`POST /api/v1/auth/login`)**: Verified for all 6 accounts.
- **Frontend TypeScript Build**: Clean (`built in 9.91s`, 0 errors).
- **Automated RBAC Test Suite**: 41 of 41 tests passed (100% pass rate).
