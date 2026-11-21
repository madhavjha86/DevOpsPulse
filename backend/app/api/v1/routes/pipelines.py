"""Built-in CI/CD Automation Pipeline API routes."""

from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, TenantContext, get_tenant_context
from app.services.pipeline_engine import pipeline_engine

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


# ── Pydantic Schemas ────────────────────────────────────────────

class PipelineCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    repo_url: str = ""
    branch: str = "main"
    trigger: str = "PUSH"
    description: str = ""
    auto_deploy: bool = True
    deploy_target: str = "kubernetes"


class TriggerRunRequest(BaseModel):
    commit_sha: str | None = None
    commit_message: str | None = None
    commit_author: str | None = None
    branch: str | None = None


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    stage_type: str
    order: int
    status: str
    logs: str | None = None
    exit_code: int | None = None
    duration_ms: int | None = None
    started_at: str | None = None
    finished_at: str | None = None


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_number: int
    status: str
    trigger: str
    branch: str | None = None
    commit_sha: str | None = None
    commit_message: str | None = None
    commit_author: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    stages: list[StageOut] = []


class PipelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    repo_url: str | None = None
    branch: str
    trigger: str
    is_active: bool
    auto_deploy: bool
    deploy_target: str | None = None
    stages_config: list | None = None
    runs: list[RunOut] = []
    created_at: str | None = None


class PipelineStatsOut(BaseModel):
    total_pipelines: int
    total_runs: int
    success_count: int
    failed_count: int
    success_rate: float
    avg_duration_ms: int


# ── Helper ──────────────────────────────────────────────────────

def _serialize_dt(obj, field: str) -> str | None:
    val = getattr(obj, field, None)
    return val.isoformat() if val else None


def _stage_to_dict(s) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "stage_type": s.stage_type,
        "order": s.order,
        "status": s.status,
        "logs": s.logs,
        "exit_code": s.exit_code,
        "duration_ms": s.duration_ms,
        "started_at": _serialize_dt(s, "started_at"),
        "finished_at": _serialize_dt(s, "finished_at"),
    }


def _run_to_dict(r) -> dict:
    return {
        "id": r.id,
        "run_number": r.run_number,
        "status": r.status,
        "trigger": r.trigger,
        "branch": r.branch,
        "commit_sha": r.commit_sha,
        "commit_message": r.commit_message,
        "commit_author": r.commit_author,
        "started_at": _serialize_dt(r, "started_at"),
        "finished_at": _serialize_dt(r, "finished_at"),
        "duration_ms": r.duration_ms,
        "stages": [_stage_to_dict(s) for s in sorted(r.stages, key=lambda x: x.order)],
    }


def _pipeline_to_dict(p) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "repo_url": p.repo_url,
        "branch": p.branch,
        "trigger": p.trigger,
        "is_active": p.is_active,
        "auto_deploy": p.auto_deploy,
        "deploy_target": p.deploy_target,
        "stages_config": p.stages_config,
        "created_at": _serialize_dt(p, "created_at"),
        "runs": [_run_to_dict(r) for r in (p.runs or [])[:10]],
    }


# ── Routes ──────────────────────────────────────────────────────

@router.get("/stats")
async def get_pipeline_stats(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await pipeline_engine.get_stats(db, tenant.organization_id)


@router.get("")
async def list_pipelines(
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pipelines = await pipeline_engine.list_pipelines(db, tenant.organization_id)
    return [_pipeline_to_dict(p) for p in pipelines]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    body: PipelineCreateRequest,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    pipeline = await pipeline_engine.create_pipeline(
        db, tenant.organization_id, tenant.user.id,
        name=body.name,
        repo_url=body.repo_url,
        branch=body.branch,
        trigger=body.trigger,
        description=body.description,
        auto_deploy=body.auto_deploy,
        deploy_target=body.deploy_target,
    )
    await db.commit()
    # Re-fetch with relationships
    p = await pipeline_engine.get_pipeline(db, pipeline.id, tenant.organization_id)
    return _pipeline_to_dict(p)


@router.get("/{pipeline_id}")
async def get_pipeline(
    pipeline_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    p = await pipeline_engine.get_pipeline(db, pipeline_id, tenant.organization_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return _pipeline_to_dict(p)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    deleted = await pipeline_engine.delete_pipeline(db, pipeline_id, tenant.organization_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.commit()


@router.post("/{pipeline_id}/trigger")
async def trigger_pipeline_run(
    pipeline_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: TriggerRunRequest | None = None,
):
    pipeline = await pipeline_engine.get_pipeline(db, pipeline_id, tenant.organization_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = await pipeline_engine.trigger_run(
        db, pipeline,
        trigger="MANUAL",
        user_id=tenant.user.id,
        commit_sha=body.commit_sha if body else None,
        commit_message=body.commit_message if body else None,
        commit_author=body.commit_author if body else None,
        branch=body.branch if body else None,
    )
    await db.commit()

    # Re-fetch with stages
    run_detail = await pipeline_engine.get_run(db, run.id)
    return _run_to_dict(run_detail)


@router.get("/{pipeline_id}/runs")
async def list_pipeline_runs(
    pipeline_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    runs = await pipeline_engine.get_runs(db, pipeline_id)
    return [_run_to_dict(r) for r in runs]


@router.get("/runs/{run_id}")
async def get_pipeline_run_detail(
    run_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    run = await pipeline_engine.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_dict(run)


@router.get("/stages/{stage_id}/logs")
async def get_stage_logs(
    stage_id: int,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    logs = await pipeline_engine.get_stage_logs(db, stage_id)
    return {"stage_id": stage_id, "logs": logs or ""}
