# 🚀 DevOpsPulse

**Open-Source Developer Productivity & CI/CD Monitoring Platform**

[![CI/CD Pipeline](https://github.com/yourusername/DevOpsPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/DevOpsPulse/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com)

---

DevOpsPulse is an enterprise-ready, open-source Developer Productivity and CI/CD Monitoring Platform. Connect your GitHub repositories, track real-time development activities, monitor GitHub Actions workflows, analyze build failure rates, and receive instant alerts when pipelines break.

---

## 🌟 Key Features

### 🔐 Enterprise Authentication & Access Control
- JWT-based authentication (secure access & refresh tokens)
- Passlib bcrypt password hashing
- GitHub OAuth 2.0 single sign-on
- Role-based authorization (`admin`, `user`, `viewer`)

### 🐙 GitHub API Integration
- Connect personal or organization GitHub accounts
- One-click public & private repository import
- Real-time commit history, pull request lifecycle, and issue tracking
- Automated GitHub Actions workflow runs synchronization
- Live webhook ingestion with HMAC-SHA256 signature verification

### 📊 Comprehensive Analytics Dashboard
- Top-level engineering KPIs: Total Repos, Commits, PRs, Open Issues, Builds, and Success Rate
- Recharts Area Chart: 30-day build success vs. failure trend
- Recharts Bar Chart: Daily workflow execution duration tracking
- Recharts Line Chart: Daily repository commit velocity
- Live interactive activity feed across all monitored repositories

### 🔔 Smart Notification Center
- Instant pipeline failure alerts
- Workflow run completion updates
- Unread badge counter with optimistic read state updates
- Configurable notification preferences

---

## 🏗️ Architecture & Technology Stack

```
                                  +---------------------------------------+
                                  |     React 18 + TypeScript + Vite      |
                                  |     Tailwind CSS + Recharts Dark UI   |
                                  +---------------------------------------+
                                                     |
                                            REST API Requests (/api/v1)
                                                     v
+------------------+              +---------------------------------------+
|  GitHub Webhooks | ------------>|         FastAPI (Python 3.12+)        |
|  & OAuth Flow    | <----------- |    Clean Layered Architecture (v1)    |
+------------------+              +---------------------------------------+
                                            /        |        \
                                           /         |         \
                                          v          v          v
                                    +----------+ +-------+ +---------+
                                    |PostgreSQL| | Redis | | Celery  |
                                    | 18 / 16  | |   7   | | Workers |
                                    +----------+ +-------+ +---------+
```

| Component | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 | High-performance async REST API |
| **Database** | PostgreSQL 18 / 16 + Alembic (7 migrations) | ACID relational persistence across 20 application models |
| **Queue / Cache**| Redis 7 + Celery 5.4 | Background sync and asynchronous alert delivery |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Premium dark SaaS developer experience |
| **Data Viz** | Recharts | Responsive, interactive metrics visualization |
| **E2E Testing** | Playwright (Chromium) | Automated user journey and browser verification |
| **DevOps** | Docker, Docker Compose, GitHub Actions | Containerized single-command local and cloud deploy |

---

## 📁 Repository Structure

```
DevOpsPulse/
├── .github/workflows/ci.yml       # GitHub Actions CI/CD pipeline
├── backend/                       # Python FastAPI backend
│   ├── alembic/                   # Database schema migrations
│   │   └── versions/              # Migration revision scripts
│   ├── app/
│   │   ├── api/v1/routes/         # REST API endpoints (auth, repos, workflows, telemetry, etc.)
│   │   ├── core/                  # Security, config, exceptions, logging
│   │   ├── db/                    # SQLAlchemy async session & declarative base
│   │   ├── models/                # 20 application ORM models (core, infra, AI, telemetry)
│   │   ├── schemas/               # Pydantic v2 request/response schemas
│   │   ├── services/              # Domain business logic & GitHub client
│   │   ├── repositories/          # Database query data access layer
│   │   ├── workers/               # Celery async tasks & app setup
│   │   ├── middleware/            # Rate limiting & request logging
│   │   └── main.py                # FastAPI application entrypoint
│   ├── tests/                     # Comprehensive Pytest suite
│   ├── Dockerfile                 # Backend container image
│   └── requirements.txt           # Python dependencies
├── frontend/                      # React TypeScript frontend
│   ├── src/
│   │   ├── components/            # UI, layout, auth, and dashboard components
│   │   ├── context/               # AuthContext for state & token management
│   │   ├── pages/                 # Full responsive application views
│   │   ├── services/              # Axios HTTP client API integrations
│   │   └── types/                 # TypeScript interfaces
│   ├── Dockerfile                 # Frontend container image
│   └── package.json               # Frontend dependencies
├── docs/                          # Architecture & API specifications
├── docker-compose.yml             # Complete stack orchestration
└── README.md
```

---

## ⚡ Quick Start (Docker Compose)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/DevOpsPulse.git
cd DevOpsPulse
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
*(Optional)* Add your GitHub OAuth app credentials in `.env` if you want to enable GitHub SSO.

### 3. Start the entire platform
```bash
docker compose up --build
```

The database migrations will run automatically on startup.

- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 Local Development Setup (Without Docker)

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔌 Integration Modes & Credential Dependencies

DevOpsPulse is engineered to be fully usable in both self-contained local environments and connected enterprise clouds. Integrations operate with progressive enhancement:

| Feature / Service | Out-of-the-Box Local Behavior | Connected Production Requirement |
|---|---|---|
| **User Authentication** | Fully functional (Bcrypt + JWT tokens) | Set strong `SECRET_KEY` (32+ random characters) |
| **GitHub OAuth 2.0** | Local username/password auth active | Register GitHub OAuth App; set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` |
| **GitHub Repository Sync** | Local seed repositories (`react`, `flask`) | Provide GitHub Personal Access Token or OAuth token for live sync |
| **Cloud Monitoring** | Demo/mock accounts with realistic metrics | Supply AWS IAM keys, Azure Service Principal, or GCP Service Account JSON |
| **Docker & Kubernetes** | Graceful offline tolerance; demo hosts/clusters | Mount `/var/run/docker.sock` or supply `KUBECONFIG` path |
| **AI Copilot & PR Review** | Rule-based static analyzer & heuristic prediction | Optional LLM API integration |
| **Asynchronous Worker** | Synchronous fallback; memory rate-limiter | Running Redis instance (`REDIS_URL=redis://localhost:6379/0`) |

> [!WARNING]
> Default demo credentials (`admin@devopspulse.com` / `Password123!`) are strictly intended for local development and integration testing. Change administrator credentials immediately upon deploying to any public or staging environment.

---

## 🧪 Automated Testing

DevOpsPulse incorporates comprehensive test suites across both backend and frontend layers:

### Backend Pytest Suite
```bash
# From the backend directory:
pytest -v
```
Validates JWT auth, password hashing, HMAC webhooks, rate limiting, and all REST endpoints (58 tests).

### Frontend Playwright End-to-End Suite
```bash
# Automated stack runner (starts Uvicorn + Vite and executes Playwright tests):
python frontend/run_e2e.py

# Or directly using the Playwright CLI:
cd frontend
npx playwright test
```
Validates authentication flows, protected route navigation, dashboard KPI cards, and repository detail views in headless Chromium (11 tests).

---

## 📡 API Reference Overview

| HTTP Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user account | No |
| `POST` | `/api/v1/auth/login` | Exchange credentials for JWT access/refresh tokens | No |
| `GET` | `/api/v1/auth/github/authorize` | Get GitHub OAuth URL | No |
| `GET` | `/api/v1/repositories` | List tracked repositories (paginated) | Yes |
| `POST` | `/api/v1/repositories/import` | Import a repository by `owner/repo` | Yes |
| `POST` | `/api/v1/repositories/{id}/sync` | Trigger on-demand sync from GitHub | Yes |
| `GET` | `/api/v1/workflows` | List GitHub Actions workflow runs | Yes |
| `GET` | `/api/v1/analytics/dashboard` | Aggregate dashboard summary metrics | Yes |
| `GET` | `/api/v1/analytics/build-trends` | 30-day build success vs. failure time-series | Yes |
| `POST` | `/api/v1/webhooks/github` | Receive GitHub events with HMAC verification | Signature Header |

Interactive Swagger documentation is available at `/docs`.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, commit conventions, and pull request guidelines.

---

## 🔒 Security

For vulnerability disclosure, please refer to [SECURITY.md](SECURITY.md).

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
