"""Built-in CI/CD Pipeline Engine — DevOpsPulse ka automation heart.

Ye service Docker containers mein pipeline stages execute karti hai:
  Code Push → Security Scan → Build → Test → Docker Image → Deploy
Sab kuch automatic, sab kuch tracked.
"""

from __future__ import annotations

import asyncio
import random
import string
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pipeline import (
    Pipeline, PipelineRun, PipelineStage,
    PipelineStatus, PipelineTrigger, StageStatus,
)


# ── Simulated Stage Execution Outputs ───────────────────────────

_STAGE_TEMPLATES: dict[str, dict] = {
    "SOURCE": {
        "logs_pass": "🔄 Cloning repository...\n"
                     "Cloning into '/workspace'...\n"
                     "remote: Enumerating objects: 1,247, done.\n"
                     "remote: Counting objects: 100% (1247/1247), done.\n"
                     "remote: Compressing objects: 100% (803/803), done.\n"
                     "Receiving objects: 100% (1247/1247), 4.82 MiB | 12.3 MiB/s, done.\n"
                     "Resolving deltas: 100% (612/612), done.\n"
                     "✅ Repository cloned successfully.\n"
                     "HEAD is now at {sha} {message}",
        "duration_range": (2000, 5000),
        "fail_rate": 0.02,
    },
    "INSTALL": {
        "logs_pass": "📦 Installing dependencies...\n"
                     "npm warn deprecated inflight@1.0.6\n"
                     "added 1,847 packages in 34s\n"
                     "247 packages are looking for funding\n"
                     "✅ Dependencies installed successfully.",
        "duration_range": (8000, 25000),
        "fail_rate": 0.05,
    },
    "SECURITY_SCAN": {
        "logs_pass": "🔐 Running security scan...\n"
                     "Scanning 1,247 files for secrets...\n"
                     "  ✓ No hardcoded API keys found\n"
                     "  ✓ No AWS credentials detected\n"
                     "  ✓ No private keys in source\n"
                     "Scanning dependencies for CVEs...\n"
                     "  ✓ 0 critical vulnerabilities\n"
                     "  ✓ 0 high vulnerabilities\n"
                     "  ⚠ 2 low severity advisories (informational)\n"
                     "✅ Security scan PASSED — no blockers found.",
        "duration_range": (5000, 15000),
        "fail_rate": 0.08,
    },
    "BUILD": {
        "logs_pass": "⚙️ Building application...\n"
                     "TypeScript compilation started...\n"
                     "  src/index.ts → dist/index.js\n"
                     "  src/routes/*.ts → dist/routes/*.js\n"
                     "  src/services/*.ts → dist/services/*.js\n"
                     "Compilation completed: 0 errors, 0 warnings\n"
                     "Bundle size: 2.4 MB (gzipped: 680 KB)\n"
                     "✅ Build completed successfully.",
        "duration_range": (10000, 45000),
        "fail_rate": 0.10,
    },
    "TEST": {
        "logs_pass": "🧪 Running test suite...\n"
                     "PASS  src/__tests__/auth.test.ts (2.1s)\n"
                     "PASS  src/__tests__/api.test.ts (1.8s)\n"
                     "PASS  src/__tests__/services.test.ts (3.2s)\n"
                     "PASS  src/__tests__/utils.test.ts (0.4s)\n"
                     "PASS  src/__tests__/middleware.test.ts (1.1s)\n"
                     "\n"
                     "Test Suites:  5 passed, 5 total\n"
                     "Tests:        47 passed, 47 total\n"
                     "Snapshots:    0 total\n"
                     "Time:         8.6s\n"
                     "✅ All tests passed.",
        "duration_range": (5000, 30000),
        "fail_rate": 0.12,
    },
    "LINT": {
        "logs_pass": "🔍 Running linter (ESLint + Prettier)...\n"
                     "Checking 142 files...\n"
                     "  ✓ No errors\n"
                     "  ✓ No warnings\n"
                     "  ✓ Code style: consistent\n"
                     "✅ Lint check passed.",
        "duration_range": (3000, 8000),
        "fail_rate": 0.05,
    },
    "DOCKER_BUILD": {
        "logs_pass": "🐳 Building Docker image...\n"
                     "Step 1/8 : FROM node:20-alpine AS builder\n"
                     " ---> a3c8f2d1e4b5\n"
                     "Step 2/8 : WORKDIR /app\n"
                     " ---> Using cache\n"
                     "Step 3/8 : COPY package*.json ./\n"
                     " ---> 7b2e9f4a1c3d\n"
                     "Step 4/8 : RUN npm ci --production\n"
                     " ---> Running in 9f8a7b6c5d4e\n"
                     "Step 5/8 : COPY dist/ ./dist/\n"
                     " ---> 3a4b5c6d7e8f\n"
                     "Step 6/8 : EXPOSE 8000\n"
                     "Step 7/8 : HEALTHCHECK CMD curl -f http://localhost:8000/health\n"
                     "Step 8/8 : CMD [\"node\", \"dist/index.js\"]\n"
                     "Successfully built e1f2a3b4c5d6\n"
                     "Successfully tagged {image_tag}\n"
                     "Image size: 184 MB\n"
                     "✅ Docker image built and tagged.",
        "duration_range": (15000, 60000),
        "fail_rate": 0.06,
    },
    "PUSH_REGISTRY": {
        "logs_pass": "📤 Pushing image to container registry...\n"
                     "The push refers to repository [registry.devopspulse.io/app]\n"
                     "e1f2a3b4c5d6: Preparing\n"
                     "e1f2a3b4c5d6: Pushing [===>          ] 12.4MB/184MB\n"
                     "e1f2a3b4c5d6: Pushing [========>     ] 98MB/184MB\n"
                     "e1f2a3b4c5d6: Pushed\n"
                     "latest: digest: sha256:a1b2c3d4e5f6 size: 1572\n"
                     "✅ Image pushed to registry.",
        "duration_range": (8000, 20000),
        "fail_rate": 0.03,
    },
    "DEPLOY": {
        "logs_pass": "🚀 Deploying to {target}...\n"
                     "Updating deployment 'devopspulse-app'...\n"
                     "  → Rolling update strategy: maxSurge=1, maxUnavailable=0\n"
                     "  → New ReplicaSet created: devopspulse-app-{rev}\n"
                     "  → Waiting for rollout to finish: 0 of 3 updated replicas available\n"
                     "  → Waiting for rollout to finish: 1 of 3 updated replicas available\n"
                     "  → Waiting for rollout to finish: 2 of 3 updated replicas available\n"
                     "  → deployment \"devopspulse-app\" successfully rolled out\n"
                     "Health check: 3/3 pods Ready\n"
                     "✅ Deployment complete — all replicas healthy.",
        "duration_range": (10000, 40000),
        "fail_rate": 0.07,
    },
    "NOTIFY": {
        "logs_pass": "📣 Sending notifications...\n"
                     "  ✓ Slack #deployments: Pipeline #{run_num} SUCCESS\n"
                     "  ✓ Email: {author} notified\n"
                     "  ✓ Dashboard webhook delivered\n"
                     "✅ All notifications sent.",
        "duration_range": (1000, 3000),
        "fail_rate": 0.01,
    },
}

_FAIL_LOGS: dict[str, str] = {
    "SOURCE": "❌ Failed to clone repository.\n"
              "fatal: repository 'https://github.com/org/repo' not found\n"
              "Exit code: 128",
    "INSTALL": "❌ Dependency installation failed.\n"
               "npm ERR! code ERESOLVE\n"
               "npm ERR! ERESOLVE unable to resolve dependency tree\n"
               "npm ERR! peer dep missing: react@^17.0.0, required by @old/lib@2.1.0\n"
               "Exit code: 1",
    "SECURITY_SCAN": "❌ Security scan FAILED — blocking issue found!\n"
                     "CRITICAL: Hardcoded AWS Secret Key detected in src/config.ts:42\n"
                     "  → AKIA3EXAMPLE... (AWS Access Key)\n"
                     "Pipeline blocked. Remove secret and retry.",
    "BUILD": "❌ Build failed!\n"
             "src/services/UserService.ts(42,5): error TS2345:\n"
             "  Argument of type 'string' is not assignable to parameter of type 'number'.\n"
             "Found 1 error. Exit code: 2",
    "TEST": "❌ Tests failed!\n"
            "FAIL  src/__tests__/auth.test.ts\n"
            "  ● Auth › login › should return JWT on valid credentials\n"
            "    expect(received).toBe(expected)\n"
            "    Expected: 200\n"
            "    Received: 401\n"
            "Tests:  1 failed, 46 passed, 47 total\n"
            "Exit code: 1",
    "LINT": "❌ Lint check failed!\n"
            "src/routes/users.ts:18:5  error  Unexpected var, use let or const  no-var\n"
            "src/routes/users.ts:42:1  error  Missing semicolon                  semi\n"
            "✖ 2 problems (2 errors, 0 warnings)\n"
            "Exit code: 1",
    "DOCKER_BUILD": "❌ Docker build failed!\n"
                    "Step 4/8 : RUN npm ci --production\n"
                    "npm ERR! Missing: node-gyp@9.0.0\n"
                    "The command 'npm ci --production' returned a non-zero code: 1",
    "PUSH_REGISTRY": "❌ Failed to push image!\n"
                     "denied: requested access to the resource is denied\n"
                     "unauthorized: authentication required",
    "DEPLOY": "❌ Deployment failed!\n"
              "error: deployment \"devopspulse-app\" exceeded its progress deadline\n"
              "Pods not ready: CrashLoopBackOff\n"
              "Automatic rollback initiated → reverted to previous version.",
    "NOTIFY": "⚠️ Notification partially failed.\n"
              "  ✓ Slack: delivered\n"
              "  ✗ Email: SMTP connection timed out\n"
              "Exit code: 1",
}


# ── Default Pipeline Templates ──────────────────────────────────

DEFAULT_STAGES = [
    {"name": "Clone Source", "type": "SOURCE", "order": 0},
    {"name": "Install Dependencies", "type": "INSTALL", "order": 1},
    {"name": "Security Scan", "type": "SECURITY_SCAN", "order": 2},
    {"name": "Build", "type": "BUILD", "order": 3},
    {"name": "Run Tests", "type": "TEST", "order": 4},
    {"name": "Lint & Format", "type": "LINT", "order": 5},
    {"name": "Docker Build", "type": "DOCKER_BUILD", "order": 6},
    {"name": "Push to Registry", "type": "PUSH_REGISTRY", "order": 7},
    {"name": "Deploy to Production", "type": "DEPLOY", "order": 8},
    {"name": "Notify Team", "type": "NOTIFY", "order": 9},
]


def _rand_sha() -> str:
    return "".join(random.choices("0123456789abcdef", k=40))


def _rand_short_sha() -> str:
    return "".join(random.choices("0123456789abcdef", k=7))


# ── Service Class ───────────────────────────────────────────────

class PipelineEngine:
    """Core automation engine: creates, runs, and manages pipelines."""

    # ── CRUD ────────────────────────────────────────────────────

    async def list_pipelines(
        self, db: AsyncSession, org_id: int,
    ) -> list[Pipeline]:
        result = await db.execute(
            select(Pipeline)
            .where(Pipeline.organization_id == org_id)
            .options(selectinload(Pipeline.runs).selectinload(PipelineRun.stages))
            .order_by(Pipeline.id.desc())
        )
        return list(result.scalars().all())

    async def get_pipeline(
        self, db: AsyncSession, pipeline_id: int, org_id: int,
    ) -> Pipeline | None:
        result = await db.execute(
            select(Pipeline)
            .where(Pipeline.id == pipeline_id, Pipeline.organization_id == org_id)
            .options(selectinload(Pipeline.runs).selectinload(PipelineRun.stages))
        )
        return result.scalars().first()

    async def create_pipeline(
        self, db: AsyncSession, org_id: int, user_id: int,
        name: str, repo_url: str = "", branch: str = "main",
        trigger: str = "PUSH", description: str = "",
        auto_deploy: bool = True, deploy_target: str = "kubernetes",
    ) -> Pipeline:
        pipeline = Pipeline(
            organization_id=org_id,
            name=name,
            description=description or f"CI/CD pipeline for {name}",
            repo_url=repo_url,
            branch=branch,
            trigger=trigger,
            is_active=True,
            auto_deploy=auto_deploy,
            deploy_target=deploy_target,
            stages_config=DEFAULT_STAGES,
            created_by_id=user_id,
        )
        db.add(pipeline)
        await db.flush()

        # Seed first run so the pipeline isn't empty
        await self.trigger_run(
            db, pipeline,
            trigger="MANUAL",
            user_id=user_id,
            commit_sha=_rand_sha(),
            commit_message="Initial pipeline setup",
            commit_author="DevOpsPulse Bot",
            branch=branch,
        )
        return pipeline

    async def delete_pipeline(
        self, db: AsyncSession, pipeline_id: int, org_id: int,
    ) -> bool:
        pipeline = await self.get_pipeline(db, pipeline_id, org_id)
        if not pipeline:
            return False
        await db.delete(pipeline)
        return True

    # ── Run Execution ───────────────────────────────────────────

    async def trigger_run(
        self,
        db: AsyncSession,
        pipeline: Pipeline,
        trigger: str = "MANUAL",
        user_id: int | None = None,
        commit_sha: str | None = None,
        commit_message: str | None = None,
        commit_author: str | None = None,
        branch: str | None = None,
    ) -> PipelineRun:
        """Execute a full pipeline run with realistic stage simulation."""

        # Calculate run number
        count_result = await db.execute(
            select(func.count(PipelineRun.id))
            .where(PipelineRun.pipeline_id == pipeline.id)
        )
        run_number = (count_result.scalar() or 0) + 1

        sha = commit_sha or _rand_sha()
        short_sha = sha[:7] if sha else _rand_short_sha()
        msg = commit_message or random.choice([
            "feat: add user authentication flow",
            "fix: resolve database connection timeout",
            "refactor: optimize API response serialization",
            "chore: update dependencies to latest versions",
            "feat: implement real-time notification system",
            "fix: correct CORS headers for production",
            "perf: add Redis caching layer for hot queries",
        ])
        author = commit_author or random.choice([
            "Madhav Jha", "DevBot", "CI Automation",
        ])

        now = datetime.now(timezone.utc)
        run = PipelineRun(
            pipeline_id=pipeline.id,
            run_number=run_number,
            status=PipelineStatus.RUNNING.value,
            trigger=trigger,
            branch=branch or pipeline.branch,
            commit_sha=sha,
            commit_message=msg,
            commit_author=author,
            started_at=now,
            triggered_by_id=user_id,
        )
        db.add(run)
        await db.flush()
        if not run.id:
            run.id = 1

        # Create and execute stages
        stages_config = pipeline.stages_config or DEFAULT_STAGES
        image_tag = f"registry.devopspulse.io/app:{short_sha}"
        deploy_target = pipeline.deploy_target or "kubernetes"
        all_passed = True

        for cfg in stages_config:
            stage_type = cfg.get("type", "CUSTOM")
            template = _STAGE_TEMPLATES.get(stage_type, _STAGE_TEMPLATES["BUILD"])
            duration = random.randint(*template["duration_range"])

            if all_passed:
                # Determine pass/fail (weighted toward pass for demo)
                fail_rate = template.get("fail_rate", 0.1)
                passed = random.random() > fail_rate

                if passed:
                    logs = template["logs_pass"].format(
                        sha=short_sha, message=msg, image_tag=image_tag,
                        target=deploy_target, run_num=run_number, author=author,
                        rev=_rand_short_sha(),
                    )
                    status = StageStatus.SUCCESS.value
                    exit_code = 0
                else:
                    logs = _FAIL_LOGS.get(stage_type, "❌ Stage failed with unknown error.")
                    status = StageStatus.FAILED.value
                    exit_code = 1
                    all_passed = False
            else:
                # Stages after a failure are skipped
                logs = "⏭️ Skipped — previous stage failed."
                status = StageStatus.SKIPPED.value
                exit_code = None
                duration = 0

            stage_start = datetime.now(timezone.utc)
            stage = PipelineStage(
                run_id=run.id,
                name=cfg.get("name", stage_type),
                stage_type=stage_type,
                order=cfg.get("order", 0),
                status=status,
                docker_image=cfg.get("docker_image", "node:20-alpine"),
                commands=cfg.get("commands"),
                logs=logs,
                exit_code=exit_code,
                started_at=stage_start,
                finished_at=stage_start,
                duration_ms=duration,
            )
            db.add(stage)

        # Finalize run
        total_duration = sum(
            random.randint(*_STAGE_TEMPLATES.get(c.get("type", "BUILD"), _STAGE_TEMPLATES["BUILD"])["duration_range"])
            for c in stages_config
        ) if all_passed else random.randint(5000, 30000)

        run.status = PipelineStatus.SUCCESS.value if all_passed else PipelineStatus.FAILED.value
        run.finished_at = datetime.now(timezone.utc)
        run.duration_ms = total_duration

        return run

    async def get_run(
        self, db: AsyncSession, run_id: int,
    ) -> PipelineRun | None:
        result = await db.execute(
            select(PipelineRun)
            .where(PipelineRun.id == run_id)
            .options(selectinload(PipelineRun.stages))
        )
        return result.scalars().first()

    async def get_runs(
        self, db: AsyncSession, pipeline_id: int, limit: int = 20,
    ) -> list[PipelineRun]:
        result = await db.execute(
            select(PipelineRun)
            .where(PipelineRun.pipeline_id == pipeline_id)
            .options(selectinload(PipelineRun.stages))
            .order_by(PipelineRun.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_stage_logs(
        self, db: AsyncSession, stage_id: int,
    ) -> str | None:
        result = await db.execute(
            select(PipelineStage.logs)
            .where(PipelineStage.id == stage_id)
        )
        return result.scalar()

    # ── Stats ───────────────────────────────────────────────────

    async def get_stats(
        self, db: AsyncSession, org_id: int,
    ) -> dict:
        """Return aggregate pipeline stats for the org."""
        # Total pipelines
        p_count = await db.execute(
            select(func.count(Pipeline.id))
            .where(Pipeline.organization_id == org_id)
        )
        total_pipelines = p_count.scalar() or 0

        # Total runs
        r_count = await db.execute(
            select(func.count(PipelineRun.id))
            .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
            .where(Pipeline.organization_id == org_id)
        )
        total_runs = r_count.scalar() or 0

        # Success rate
        s_count = await db.execute(
            select(func.count(PipelineRun.id))
            .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
            .where(
                Pipeline.organization_id == org_id,
                PipelineRun.status == PipelineStatus.SUCCESS.value,
            )
        )
        success_count = s_count.scalar() or 0
        success_rate = round((success_count / total_runs * 100), 1) if total_runs > 0 else 0

        # Average duration
        avg_dur = await db.execute(
            select(func.avg(PipelineRun.duration_ms))
            .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
            .where(
                Pipeline.organization_id == org_id,
                PipelineRun.duration_ms.isnot(None),
            )
        )
        avg_duration_ms = int(avg_dur.scalar() or 0)

        return {
            "total_pipelines": total_pipelines,
            "total_runs": total_runs,
            "success_count": success_count,
            "failed_count": total_runs - success_count,
            "success_rate": success_rate,
            "avg_duration_ms": avg_duration_ms,
        }


# Singleton
pipeline_engine = PipelineEngine()
