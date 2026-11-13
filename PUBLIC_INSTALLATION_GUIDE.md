# DevOpsPulse — Public Installation & Deployment Guide

Welcome to **DevOpsPulse**, the open-source Developer Productivity and CI/CD Observability Platform. This guide provides comprehensive, step-by-step instructions to install, configure, and run DevOpsPulse on **Windows**, **Linux**, and **macOS**, as well as via **Docker Compose**.

---

## 📋 System Prerequisites

| Component | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Python** | 3.12+ | 3.12 or 3.13 | Backend API, Celery, and Alembic |
| **Node.js** | 20.x LTS | 20.x or 22.x | Frontend Vite, TypeScript, and React |
| **npm** | 10.x | 10.x+ | Node package manager |
| **PostgreSQL** | 16.x | 18.x or 16.x | Primary relational database |
| **Redis** | 7.x | 7.x+ | Caching, Rate limiting, and Celery broker |
| **Git** | 2.40+ | Latest | Version control |
| **Docker** *(Optional)* | 24.x+ | Latest | For full containerized orchestration |

---

## 🚀 Option 1: Quickstart with Docker Compose (Recommended)

Docker Compose starts PostgreSQL, Redis, the FastAPI backend, and the Vite frontend in synchronized containers with zero manual configuration.

### 1. Clone the Repository
```bash
git clone https://github.com/madhavjha86/DevOpsPulse.git
cd DevOpsPulse
```

### 2. Configure Environment Files
Copy the example environment templates:
```bash
# Root and backend environment
cp .env.example .env
cp backend/.env.example backend/.env
```

### 3. Launch Containers
```bash
docker compose up --build
```

### 4. Verify Services
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

To stop services:
```bash
docker compose down
```

---

## 💻 Option 2: Local Native Setup (Windows, Linux, macOS)

### Step 1: Clone the Repository
```bash
git clone https://github.com/madhavjha86/DevOpsPulse.git
cd DevOpsPulse
```

---

### Step 2: Database & Redis Setup

#### On Windows:
1. Ensure **PostgreSQL** service is running (default port `5432`).
2. Open pgAdmin 4 or `psql` and create the database:
   ```sql
   CREATE DATABASE devopspulse;
   ```
3. Start **Redis**:
   - Via Docker: `docker run -d -p 6379:6379 --name devopspulse-redis redis:7-alpine`
   - Or via Memurai / Redis for Windows.

#### On Linux (Ubuntu / Debian):
```bash
# Install and start PostgreSQL & Redis
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server

# Start services
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# Create database and user
sudo -u postgres psql -c "CREATE USER devopspulse WITH PASSWORD 'devopspulse';"
sudo -u postgres psql -c "CREATE DATABASE devopspulse OWNER devopspulse;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE devopspulse TO devopspulse;"
```

#### On macOS (Homebrew):
```bash
# Install and start PostgreSQL & Redis
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# Create database
createdb devopspulse
```

---

### Step 3: Backend Setup (FastAPI & SQLAlchemy)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   - **Linux / macOS:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows (PowerShell):**
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```

3. **Install Python dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure `backend/.env`:**
   Copy `backend/.env.example` to `backend/.env` and update credentials:
   ```bash
   cp .env.example .env
   ```
   *Edit `backend/.env` with your database credentials:*
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_local_pg_password
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=devopspulse

   DATABASE_URL=postgresql+asyncpg://postgres:your_local_pg_password@localhost:5432/devopspulse
   DATABASE_URL_SYNC=postgresql://postgres:your_local_pg_password@localhost:5432/devopspulse

   SECRET_KEY=generate-a-secure-random-64-character-hex-string
   REDIS_URL=redis://localhost:6379/0
   FRONTEND_URL=http://localhost:3000
   ```

5. **Run Database Migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Seed Initial Demo Accounts & Workspaces (Optional for Local Development):**
   ```bash
   python scripts/seed_rbac_accounts.py
   python seed_data.py
   ```

7. **Start the FastAPI Backend Server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   API will be live at `http://localhost:8000`.

---

### Step 4: Frontend Setup (React & Vite)

1. **Open a new terminal and navigate to `frontend`:**
   ```bash
   cd frontend
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Verify configuration (`frontend/.env`):**
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   Frontend will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 🔑 Default Development / Demo Test Accounts

When seeded using `scripts/seed_rbac_accounts.py`, the following sandbox accounts are provisioned:

| Role | Email | Purpose / Permitted Scope |
|---|---|---|
| **Super Admin** | `admin@devopspulse.com` | Root system access, cross-tenant auditing, global user admin |
| **Org Admin** | `orgadmin@devopspulse.local` | Full organization workspace control, member invitations, role changes |
| **DevOps Engineer** | `devops@devopspulse.local` | Pipelines, Docker hosts, Kubernetes clusters, Cloud Telemetry, Cost |
| **Developer** | `developer@company.com` | Repositories, PR reviews, AI failure prediction, code intelligence |
| **Security Engineer** | `security@devopspulse.local` | Vulnerabilities, CVEs, secret leak reports, audit logs |
| **Viewer** | `viewer@devopspulse.local` | Read-only visibility into metrics, DORA stats, and status |

> [!NOTE]
> For local development passwords, refer to your local `TEST_ACCOUNTS_LOCAL.md` (which is excluded from Git via `.gitignore`). In production, all users create their own passwords via the secure invitation flow.

---

## 🛠️ Verification & Testing

### Run Backend Pytest Suite
```bash
cd backend
python -m pytest tests/ -v
```

### Run Frontend Lint & Build
```bash
cd frontend
npm run lint
npm run build
```

---

## ❓ Troubleshooting & Common Issues

### 1. `connection to server at "localhost" port 5432 failed`
- **Cause:** PostgreSQL service is stopped or listening on another port.
- **Fix:**
  - On Windows: Open Services (`services.msc`), find `postgresql-x64-18` or `postgresql-x64-16`, and click **Start**.
  - On Linux: `sudo systemctl restart postgresql`.
  - On macOS: `brew services restart postgresql@16`.

### 2. `alembic: command not found`
- **Fix:** Ensure your virtual environment is activated (`source venv/bin/activate` or `.\venv\Scripts\Activate.ps1`).

### 3. Special characters in Database Password (`@`, `#`, `$`, `%`)
- **Fix:** If your PostgreSQL password contains special characters, ensure it is URL-encoded in `DATABASE_URL` (e.g. `@` is encoded as `%40`), while `POSTGRES_PASSWORD` retains the raw password.

### 4. Port 3000 or 8000 already in use
- **Fix:** Find and terminate the process holding the port:
  - On Windows: `netstat -ano | findstr :8000` then `taskkill /PID <PID> /F`
  - On Linux / macOS: `lsof -i :8000` then `kill -9 <PID>`

---

## 📄 License
DevOpsPulse is open-source software licensed under the [MIT License](LICENSE).
