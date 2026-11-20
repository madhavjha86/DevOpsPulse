"""DevOps Context Aggregator assembling multi-system infrastructure telemetry for AI reasoning."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security_redaction import redact_dict, redact_secrets
from app.models.cloud_cost import CloudCostAnomaly
from app.models.incident import Incident
from app.models.repository import Repository
from app.models.security_scan import SecurityScan
from app.models.telemetry import TelemetryLog
from app.models.workflow_run import WorkflowRun


class DevOpsContextAggregator:
    """Assembles tenant-isolated, redacted telemetry and event context across all DevOpsPulse subsystems."""

    @classmethod
    async def aggregate_context(
        cls,
        db: AsyncSession,
        user_id: int,
        organization_id: int | None = None,
        query: str | None = None,
    ) -> dict[str, Any]:
        """Collect live context from Git, CI/CD, Logs, Incidents, Cloud Costs, and Security."""
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)

        sources_cited: list[dict[str, Any]] = []

        # 1. CI/CD Failures & Active Runs
        wf_stmt = (
            select(WorkflowRun, Repository.name.label("repo_name"))
            .join(Repository, WorkflowRun.repository_id == Repository.id, isouter=True)
        )
        if organization_id is not None:
            wf_stmt = wf_stmt.where(Repository.organization_id == organization_id)
        wf_stmt = wf_stmt.order_by(desc(WorkflowRun.created_at)).limit(5)
        wf_res = await db.execute(wf_stmt)
        recent_runs = []
        for r, rname in wf_res.all():
            run_item = {
                "id": r.id,
                "workflow_name": r.workflow_name,
                "repository": rname or "devopspulse-core",
                "branch": r.branch,
                "status": r.status,
                "conclusion": r.conclusion,
                "run_number": r.run_number,
                "duration_seconds": r.duration_seconds,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            recent_runs.append(run_item)
            if r.conclusion == "failure":
                sources_cited.append({
                    "type": "workflow_failure",
                    "id": r.id,
                    "title": f"Run #{r.run_number or r.id} ({r.workflow_name})",
                    "repo": rname,
                    "branch": r.branch,
                })

        # 2. Critical Telemetry Logs (ERROR & FATAL)
        log_stmt = select(TelemetryLog).where(
            TelemetryLog.user_id == user_id,
            TelemetryLog.level.in_(["ERROR", "FATAL", "WARN"]),
            TelemetryLog.timestamp >= since_24h,
        )
        if organization_id is not None:
            log_stmt = log_stmt.where(TelemetryLog.organization_id == organization_id)
        log_stmt = log_stmt.order_by(desc(TelemetryLog.timestamp)).limit(6)
        log_res = await db.execute(log_stmt)
        critical_logs = []
        for l in log_res.scalars().all():
            critical_logs.append({
                "service": l.service_name,
                "level": l.level,
                "message": redact_secrets(l.message[:300]),
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "trace_id": l.trace_id,
            })
            sources_cited.append({
                "type": "log_error",
                "id": l.id,
                "title": f"[{l.level}] {l.service_name}: {l.message[:40]}...",
                "service": l.service_name,
            })

        # 3. Active Incidents & MTTR Alerts
        inc_stmt = select(Incident).where(
            Incident.user_id == user_id,
            Incident.status.in_(["OPEN", "INVESTIGATING", "ACKNOWLEDGED"]),
        )
        if organization_id is not None:
            inc_stmt = inc_stmt.where(Incident.organization_id == organization_id)
        inc_stmt = inc_stmt.order_by(desc(Incident.created_at)).limit(4)
        inc_res = await db.execute(inc_stmt)
        active_incidents = []
        for inc in inc_res.scalars().all():
            active_incidents.append({
                "id": inc.id,
                "title": inc.title,
                "severity": inc.severity,
                "priority": inc.priority,
                "service": inc.service,
                "status": inc.status,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            })
            sources_cited.append({
                "type": "incident",
                "id": inc.id,
                "title": f"Incident #{inc.id}: {inc.title}",
                "severity": inc.severity,
            })

        # 4. Cloud Cost Spikes & Anomalies
        cost_stmt = select(CloudCostAnomaly).where(
            CloudCostAnomaly.user_id == user_id,
            CloudCostAnomaly.status == "ACTIVE",
        )
        if organization_id is not None:
            cost_stmt = cost_stmt.where(CloudCostAnomaly.organization_id == organization_id)
        cost_stmt = cost_stmt.order_by(desc(CloudCostAnomaly.anomaly_date)).limit(3)
        cost_res = await db.execute(cost_stmt)
        cost_anomalies = []
        for c in cost_res.scalars().all():
            cost_anomalies.append({
                "service": c.service_name,
                "amount": float(c.actual_amount) if c.actual_amount else 0.0,
                "expected": float(c.expected_amount) if c.expected_amount else 0.0,
                "percentage_increase": float(c.spike_percentage) if c.spike_percentage else 0.0,
                "date": c.anomaly_date.isoformat() if c.anomaly_date else None,
            })
            sources_cited.append({
                "type": "cloud_cost_anomaly",
                "id": c.id,
                "title": f"{c.service_name} spike (+{c.spike_percentage:.0f}%)",
            })

        # 5. Security & CVE Scans
        sec_stmt = select(SecurityScan).where(SecurityScan.user_id == user_id)
        if organization_id is not None:
            sec_stmt = sec_stmt.where(SecurityScan.organization_id == organization_id)
        sec_stmt = sec_stmt.order_by(desc(SecurityScan.created_at)).limit(3)
        sec_res = await db.execute(sec_stmt)
        security_findings = []
        for s in sec_res.scalars().all():
            security_findings.append({
                "id": s.id,
                "scan_type": s.scan_type,
                "critical_count": s.critical_count or 0,
                "high_count": s.high_count or 0,
                "status": s.status,
            })

        context_data = {
            "current_time_utc": now.isoformat(),
            "recent_pipeline_runs": recent_runs,
            "critical_application_logs": critical_logs,
            "active_incidents": active_incidents,
            "cloud_cost_spikes": cost_anomalies,
            "security_scan_status": security_findings,
        }

        # Deduplicate sources cited
        unique_sources = []
        seen = set()
        for src in sources_cited:
            key = (src.get("type"), src.get("id"))
            if key not in seen:
                seen.add(key)
                unique_sources.append(src)

        return {
            "data": redact_dict(context_data),
            "sources": unique_sources[:6],
        }

    @classmethod
    def format_context_for_prompt(cls, context_dict: dict[str, Any]) -> str:
        """Format aggregated context into clean structured markdown text for the LLM system prompt."""
        data = context_dict.get("data", {})
        lines: list[str] = [
            "### Live DevOpsPulse Telemetry & Context:",
            f"Timestamp (UTC): {data.get('current_time_utc')}\n",
        ]

        # Pipelines
        pipelines = data.get("recent_pipeline_runs", [])
        if pipelines:
            lines.append("**Recent CI/CD Pipeline Runs:**")
            for p in pipelines:
                conc = (p.get("conclusion") or p.get("status") or "unknown").upper()
                lines.append(
                    f"- {p.get('repository')} / {p.get('workflow_name')} ({p.get('branch')}): "
                    f"Result={conc}, Duration={p.get('duration_seconds')}s, Commit={p.get('commit_sha')}"
                )
            lines.append("")

        # Logs
        logs = data.get("critical_application_logs", [])
        if logs:
            lines.append("**Recent Critical Telemetry Logs (Past 24h):**")
            for l in logs:
                lines.append(f"- [{l.get('level')}] {l.get('service')} at {l.get('timestamp')}: {l.get('message')}")
            lines.append("")

        # Incidents
        incidents = data.get("active_incidents", [])
        if incidents:
            lines.append("**Active Open Incidents:**")
            for inc in incidents:
                lines.append(
                    f"- Incident #{inc.get('id')} [{inc.get('severity')}/{inc.get('priority')}]: "
                    f"'{inc.get('title')}' on {inc.get('service')} ({inc.get('status')})"
                )
            lines.append("")

        # Cloud Costs
        costs = data.get("cloud_cost_spikes", [])
        if costs:
            lines.append("**Cloud Cost Anomaly Alerts:**")
            for c in costs:
                lines.append(
                    f"- {c.get('service')}: Actual=${c.get('amount')} vs Expected=${c.get('expected')} "
                    f"(+{c.get('percentage_increase')}% surge on {c.get('date')})"
                )
            lines.append("")

        return "\n".join(lines)
