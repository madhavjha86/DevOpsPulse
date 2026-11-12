# DevOpsPulse — Required Credentials and Integration Setup Guide
**Audience:** DevOps Engineers, Platform Administrators, Security Leads  
**Version:** 1.1 Production  

This guide details the exact credentials, IAM policies, network ports, and configuration environment variables required to activate all real-data integrations in DevOpsPulse.

---

## 1. Environment Variable Configuration (`backend/.env`)

Below is the master `.env` template required for full real-data functionality:

```bash
# --- Application Core ---
APP_NAME=DevOpsPulse
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=generate-a-secure-random-64-character-hex-key
BACKEND_CORS_ORIGINS=["http://localhost:3000","https://devopspulse.yourdomain.com"]

# --- Database (PostgreSQL 18) ---
DATABASE_URL=postgresql+asyncpg://postgres:YourSecurePassword@localhost:5432/devopspulse

# --- Redis & Celery Workers ---
REDIS_URL=redis://localhost:6379/0

# --- GitHub Integration ---
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-hmac-sha256-secret
GITHUB_API_BASE_URL=https://api.github.com

# --- AI Intelligence Providers (Choose at least one) ---
GEMINI_API_KEY=AIzaSy...your-google-gemini-key
OPENAI_API_KEY=sk-proj-...your-openai-api-key

# --- AWS Cloud FinOps Integration ---
AWS_ACCESS_KEY_ID=AKIA...your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_DEFAULT_REGION=us-east-1

# --- Microsoft Azure FinOps Integration ---
AZURE_TENANT_ID=your-azure-tenant-guid
AZURE_CLIENT_ID=your-azure-service-principal-client-id
AZURE_CLIENT_SECRET=your-azure-service-principal-secret
AZURE_SUBSCRIPTION_ID=your-azure-subscription-guid

# --- Google Cloud Platform FinOps Integration ---
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account-key.json
GCP_BILLING_BIGQUERY_DATASET=your_billing_export_dataset
```

---

## 2. GitHub Integration Setup

### A. Personal Access Token (PAT) or OAuth App
1. Navigate to **GitHub Settings -> Developer settings -> Personal access tokens (Tokens classic)**.
2. Generate a token with the following scopes:
   - `repo` (Full control of private repositories: code, commits, pull requests, issues).
   - `workflow` (Required to list and trigger GitHub Actions workflow runs).
   - `read:org` (Required to list organizational repositories).
   - `read:user` (Required for profile and email identification).
3. If creating an OAuth App for team access:
   - **Authorization callback URL:** `http://localhost:3000/auth/github/callback` (or your production domain).

### B. GitHub Repository Webhook Setup
1. In your GitHub repository, navigate to **Settings -> Webhooks -> Add webhook**.
2. Configure:
   - **Payload URL:** `https://your-api-domain.com/api/v1/webhooks/github` (or your ngrok URL for local dev).
   - **Content type:** `application/json`
   - **Secret:** Enter the exact string configured in `GITHUB_WEBHOOK_SECRET`.
   - **Events to trigger:** Select **Let me select individual events**:
     - `Pushes`
     - `Pull requests`
     - `Workflow runs`
     - `Deployments`
   - **Active:** Checked.

---

## 3. Docker Engine Daemon Setup

DevOpsPulse monitors container metrics, memory, and CPU by querying the Docker REST API v1.45.

### Option A: Local Unix Socket (Linux / macOS / WSL2)
- DevOpsPulse backend can connect directly to `/var/run/docker.sock`.
- Ensure the user running the backend process is added to the `docker` group:
  ```bash
  sudo usermod -aG docker $USER
  ```

### Option B: TCP Socket on Windows (Docker Desktop)
1. Open **Docker Desktop Settings -> General**.
2. Check **Expose daemon on tcp://localhost:2375 without TLS**.
3. In DevOpsPulse: Navigate to **Docker Containers -> Add Host**:
   - **Name:** Local Docker Desktop
   - **Host URL:** `http://localhost:2375`
   - **TLS Verify:** `false`

### Option C: Production Remote Docker Host with TLS
- Start daemon with TLS certificates:
  ```bash
  dockerd --tlsverify --tlscacert=ca.pem --tlscert=server-cert.pem --tlskey=server-key.pem -H=0.0.0.0:2376
  ```
- Configure Host URL as `https://your-docker-node:2376` with TLS verification enabled.

---

## 4. Kubernetes Cluster Integration Setup

DevOpsPulse interacts directly with the Kubernetes API Server to list nodes, pods, namespaces, and workloads.

### Step 1: Create a Read-Only ServiceAccount & ClusterRole
Apply the following manifest to your cluster:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: devopspulse-monitor
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: devopspulse-reader
rules:
- apiGroups: [""]
  resources: ["nodes", "namespaces", "pods", "pods/log", "services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "daemonsets", "statefulsets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: devopspulse-reader-binding
subjects:
- kind: ServiceAccount
  name: devopspulse-monitor
  namespace: kube-system
roleRef:
  kind: ClusterRole
  name: devopspulse-reader
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Secret
metadata:
  name: devopspulse-token
  namespace: kube-system
  annotations:
    kubernetes.io/service-account.name: devopspulse-monitor
type: kubernetes.io/service-account-token
```

### Step 2: Retrieve Bearer Token & API Server URL
```bash
# Get Bearer Token
kubectl -n kube-system get secret devopspulse-token -o jsonpath='{.data.token}' | base64 --decode

# Get API Server URL
kubectl cluster-info
```

### Step 3: Register Cluster in DevOpsPulse UI
- In **Kubernetes -> Add Cluster**:
  - **Cluster Name:** Production EKS / GKE / Minikube
  - **API Server URL:** e.g. `https://127.0.0.1:6443` or your cluster endpoint.
  - **Bearer Token:** Paste the decoded token string.
  - **Namespace Filter:** `all` (or specific namespace).

---

## 5. Cloud Cost Intelligence (FinOps) Setup

### AWS Cost Explorer Setup
1. Create an IAM User or Role with read-only Cost Explorer access.
2. Attach the following minimal IAM policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ce:GetCostAndUsage",
           "ce:GetCostForecast",
           "ce:GetDimensionValues",
           "ce:GetReservationUtilization"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
3. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `backend/.env`.

### Microsoft Azure Cost Management Setup
1. Register an Application in Microsoft Entra ID (Azure AD).
2. Assign the **Cost Management Reader** RBAC role to the application at the Subscription scope.
3. Configure `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_SUBSCRIPTION_ID`.

### Google Cloud Platform Billing Export Setup
1. In GCP Console: Go to **Billing -> Billing export -> Detailed usage cost**.
2. Select or create a BigQuery dataset (e.g. `gcp_billing_export`).
3. Grant the DevOpsPulse service account the role **BigQuery Data Viewer** on this dataset.
4. Set `GOOGLE_APPLICATION_CREDENTIALS` pointing to the downloaded JSON key.

---

## 6. AI Root Cause Analysis & Copilot Setup

DevOpsPulse natively supports both Google Gemini and OpenAI:

- **Google Gemini (Recommended):**
  - Visit [Google AI Studio](https://aistudio.google.com/) and generate an API key.
  - Set `GEMINI_API_KEY=AIzaSy...` in `backend/.env`.
  - Powers both AI Root Cause Analysis and conversational DevOps Copilot.

- **OpenAI (Alternative):**
  - Visit [OpenAI Platform](https://platform.openai.com/) and generate an API key.
  - Set `OPENAI_API_KEY=sk-proj-...` in `backend/.env`.

---

## 7. OpenTelemetry Ingestion Setup

To stream application logs and distributed traces into DevOpsPulse:
- **HTTP Log Ingestion:** `POST /api/v1/telemetry/logs` with payload:
  ```json
  {
    "service_name": "payment-api",
    "level": "ERROR",
    "message": "Payment gateway connection timeout",
    "trace_id": "7a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d",
    "attributes": { "http.status": 504, "customer_id": 1042 }
  }
  ```
- **HTTP Span Ingestion:** `POST /api/v1/telemetry/spans` with start/end timestamps and parent span IDs for trace waterfalls.
