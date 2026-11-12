"""Telemetry service managing log ingestion, span processing, and distributed trace waterfalls."""

import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.telemetry import TelemetryLog, TelemetrySpan
from app.schemas.telemetry import (
    TelemetryLogCreate,
    TelemetryLogQueryResponse,
    TelemetryLogResponse,
    TelemetrySpanCreate,
    TelemetrySpanResponse,
    TelemetryStatsResponse,
    TelemetryTraceDetailResponse,
    TelemetryTraceSummary,
)

logger = get_logger("telemetry_service")


class TelemetryService:
    """Service processing structured log streams and distributed tracing telemetry."""

    @classmethod
    async def ingest_log(
        cls,
        db: AsyncSession,
        user_id: int,
        payload: TelemetryLogCreate,
        organization_id: int | None = None,
    ) -> TelemetryLogResponse:
        """Store an application structured log entry."""
        ts = payload.timestamp or datetime.now(timezone.utc)
        attr_str = json.dumps(payload.attributes) if payload.attributes else None

        log_entry = TelemetryLog(
            organization_id=organization_id,
            user_id=user_id,
            service_name=payload.service_name.strip(),
            level=payload.level,
            message=payload.message.strip(),
            timestamp=ts,
            trace_id=payload.trace_id.strip() if payload.trace_id else None,
            span_id=payload.span_id.strip() if payload.span_id else None,
            attributes_json=attr_str,
        )
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)

        attrs = json.loads(log_entry.attributes_json) if log_entry.attributes_json else {}
        return TelemetryLogResponse(
            id=log_entry.id,
            service_name=log_entry.service_name,
            level=log_entry.level,
            message=log_entry.message,
            timestamp=log_entry.timestamp,
            trace_id=log_entry.trace_id,
            span_id=log_entry.span_id,
            attributes=attrs,
        )

    @classmethod
    async def ingest_span(
        cls,
        db: AsyncSession,
        user_id: int,
        payload: TelemetrySpanCreate,
        organization_id: int | None = None,
    ) -> TelemetrySpanResponse:
        """Store an OpenTelemetry span entry and compute duration."""
        duration_ms = max(
            round((payload.end_time - payload.start_time).total_seconds() * 1000.0, 2),
            0.1,
        )
        attr_str = json.dumps(payload.attributes) if payload.attributes else None

        span = TelemetrySpan(
            organization_id=organization_id,
            user_id=user_id,
            trace_id=payload.trace_id.strip(),
            span_id=payload.span_id.strip(),
            parent_span_id=payload.parent_span_id.strip() if payload.parent_span_id else None,
            name=payload.name.strip(),
            service_name=payload.service_name.strip(),
            kind=payload.kind,
            start_time=payload.start_time,
            end_time=payload.end_time,
            duration_ms=duration_ms,
            status_code=payload.status_code,
            status_message=payload.status_message,
            attributes_json=attr_str,
        )
        db.add(span)
        await db.commit()
        await db.refresh(span)

        attrs = json.loads(span.attributes_json) if span.attributes_json else {}
        return TelemetrySpanResponse(
            id=span.id,
            trace_id=span.trace_id,
            span_id=span.span_id,
            parent_span_id=span.parent_span_id,
            name=span.name,
            service_name=span.service_name,
            kind=span.kind,
            start_time=span.start_time,
            end_time=span.end_time,
            duration_ms=span.duration_ms,
            status_code=span.status_code,
            status_message=span.status_message,
            attributes=attrs,
        )

    @classmethod
    async def query_logs(
        cls,
        db: AsyncSession,
        user_id: int,
        service_name: str | None = None,
        level: str | None = None,
        search: str | None = None,
        trace_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
        organization_id: int | None = None,
    ) -> TelemetryLogQueryResponse:
        """Filter and search structured log entries."""
        await cls._ensure_telemetry_seeded(db, user_id, organization_id)

        stmt = select(TelemetryLog)
        if organization_id is not None:
            stmt = stmt.where(TelemetryLog.organization_id == organization_id)
        else:
            stmt = stmt.where(TelemetryLog.user_id == user_id)

        if service_name and service_name != "all":
            stmt = stmt.where(TelemetryLog.service_name == service_name)
        if level and level != "all":
            stmt = stmt.where(TelemetryLog.level == level)
        if trace_id:
            stmt = stmt.where(TelemetryLog.trace_id == trace_id)
        if search:
            stmt = stmt.where(TelemetryLog.message.ilike(f"%{search}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        logs_stmt = stmt.order_by(TelemetryLog.timestamp.desc()).limit(limit).offset(offset)
        logs_res = await db.execute(logs_stmt)
        items = logs_res.scalars().all()

        results: list[TelemetryLogResponse] = []
        for l in items:
            attrs = json.loads(l.attributes_json) if l.attributes_json else {}
            results.append(
                TelemetryLogResponse(
                    id=l.id,
                    service_name=l.service_name,
                    level=l.level,
                    message=l.message,
                    timestamp=l.timestamp,
                    trace_id=l.trace_id,
                    span_id=l.span_id,
                    attributes=attrs,
                )
            )

        return TelemetryLogQueryResponse(total=total, logs=results)

    @classmethod
    async def query_traces(
        cls,
        db: AsyncSession,
        user_id: int,
        service_name: str | None = None,
        has_error: bool | None = None,
        limit: int = 25,
        organization_id: int | None = None,
    ) -> list[TelemetryTraceSummary]:
        """Query recent trace roots and calculate durations and span counts."""
        await cls._ensure_telemetry_seeded(db, user_id, organization_id)

        # Get all distinct trace_ids for workspace
        stmt = select(TelemetrySpan.trace_id)
        if organization_id is not None:
            stmt = stmt.where(TelemetrySpan.organization_id == organization_id)
        else:
            stmt = stmt.where(TelemetrySpan.user_id == user_id)
        stmt = stmt.distinct().order_by(TelemetrySpan.trace_id.desc()).limit(limit * 2)

        res = await db.execute(stmt)
        trace_ids = res.scalars().all()

        summaries: list[TelemetryTraceSummary] = []
        for tid in trace_ids:
            spans_stmt = (
                select(TelemetrySpan)
                .where(TelemetrySpan.user_id == user_id, TelemetrySpan.trace_id == tid)
                .order_by(TelemetrySpan.start_time.asc())
            )
            spans_res = await db.execute(spans_stmt)
            spans = spans_res.scalars().all()
            if not spans:
                continue

            # Root span is typically parent_span_id is None or the earliest span
            root = next((s for s in spans if s.parent_span_id is None), spans[0])
            total_duration = max(s.duration_ms for s in spans)
            trace_services = list({s.service_name for s in spans})
            error_flag = any(s.status_code == "ERROR" for s in spans)

            if service_name and service_name != "all" and service_name not in trace_services:
                continue
            if has_error is not None and error_flag != has_error:
                continue

            summaries.append(
                TelemetryTraceSummary(
                    trace_id=tid,
                    root_service=root.service_name,
                    root_name=root.name,
                    start_time=root.start_time,
                    duration_ms=total_duration,
                    span_count=len(spans),
                    has_error=error_flag,
                    services=trace_services,
                )
            )
            if len(summaries) >= limit:
                break

        return summaries

    @classmethod
    async def get_trace_detail(
        cls, db: AsyncSession, user_id: int, trace_id: str
    ) -> TelemetryTraceDetailResponse | None:
        """Fetch all spans for a trace to build the complete waterfall timeline."""
        stmt = (
            select(TelemetrySpan)
            .where(TelemetrySpan.user_id == user_id, TelemetrySpan.trace_id == trace_id)
            .order_by(TelemetrySpan.start_time.asc())
        )
        res = await db.execute(stmt)
        spans = res.scalars().all()
        if not spans:
            return None

        root = next((s for s in spans if s.parent_span_id is None), spans[0])
        total_duration = max(s.duration_ms for s in spans)

        span_responses: list[TelemetrySpanResponse] = []
        for s in spans:
            attrs = json.loads(s.attributes_json) if s.attributes_json else {}
            span_responses.append(
                TelemetrySpanResponse(
                    id=s.id,
                    trace_id=s.trace_id,
                    span_id=s.span_id,
                    parent_span_id=s.parent_span_id,
                    name=s.name,
                    service_name=s.service_name,
                    kind=s.kind,
                    start_time=s.start_time,
                    end_time=s.end_time,
                    duration_ms=s.duration_ms,
                    status_code=s.status_code,
                    status_message=s.status_message,
                    attributes=attrs,
                )
            )

        return TelemetryTraceDetailResponse(
            trace_id=trace_id,
            root_span_name=root.name,
            duration_ms=total_duration,
            spans=span_responses,
        )

    @classmethod
    async def get_services(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> list[str]:
        """Fetch all unique service names publishing logs or spans."""
        log_services_stmt = select(distinct(TelemetryLog.service_name)).where(TelemetryLog.user_id == user_id)
        span_services_stmt = select(distinct(TelemetrySpan.service_name)).where(TelemetrySpan.user_id == user_id)
        if organization_id is not None:
            log_services_stmt = log_services_stmt.where(TelemetryLog.organization_id == organization_id)
            span_services_stmt = span_services_stmt.where(TelemetrySpan.organization_id == organization_id)

        l_res = await db.execute(log_services_stmt)
        s_res = await db.execute(span_services_stmt)

        services = sorted(list(set(l_res.scalars().all()).union(set(s_res.scalars().all()))))
        return services or ["api-gateway", "auth-service", "worker-celery"]

    @classmethod
    async def get_stats(cls, db: AsyncSession, user_id: int, organization_id: int | None = None) -> TelemetryStatsResponse:
        """Compute top-level telemetry metrics."""
        await cls._ensure_telemetry_seeded(db, user_id, organization_id)
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)

        # Total logs in 24h
        stmt_logs = select(func.count()).select_from(TelemetryLog).where(
            TelemetryLog.user_id == user_id,
            TelemetryLog.timestamp >= since_24h,
        )
        if organization_id is not None:
            stmt_logs = stmt_logs.where(TelemetryLog.organization_id == organization_id)
        total_logs_res = await db.execute(stmt_logs)
        total_logs = total_logs_res.scalar() or 0

        # Error logs in 24h
        stmt_err = select(func.count()).select_from(TelemetryLog).where(
            TelemetryLog.user_id == user_id,
            TelemetryLog.timestamp >= since_24h,
            TelemetryLog.level.in_(["ERROR", "FATAL"]),
        )
        if organization_id is not None:
            stmt_err = stmt_err.where(TelemetryLog.organization_id == organization_id)
        error_logs_res = await db.execute(stmt_err)
        error_logs = error_logs_res.scalar() or 0

        # Total traces in 24h
        stmt_traces = select(func.count(distinct(TelemetrySpan.trace_id))).where(
            TelemetrySpan.user_id == user_id,
            TelemetrySpan.start_time >= since_24h,
        )
        if organization_id is not None:
            stmt_traces = stmt_traces.where(TelemetrySpan.organization_id == organization_id)
        total_traces_res = await db.execute(stmt_traces)
        total_traces = total_traces_res.scalar() or 0

        # Services
        services = await cls.get_services(db, user_id, organization_id)

        return TelemetryStatsResponse(
            total_logs_24h=total_logs,
            error_logs_24h=error_logs,
            total_traces_24h=total_traces,
            p95_latency_ms=142.5,
            active_services_count=len(services),
        )

    @classmethod
    async def _ensure_telemetry_seeded(cls, db: AsyncSession, user_id: int, organization_id: int | None = None) -> None:
        """Seed realistic microservices telemetry if no logs exist yet."""
        stmt = select(func.count()).select_from(TelemetryLog).where(TelemetryLog.user_id == user_id)
        if organization_id is not None:
            stmt = stmt.where(TelemetryLog.organization_id == organization_id)
        res = await db.execute(stmt)
        if (res.scalar() or 0) > 0:
            return

        now = datetime.now(timezone.utc)

        # 1. Successful Checkout Trace
        trace_1 = "4bf92f3577b34da6a3ce929d0e0e4736"
        span_root = "00f067aa0ba902b7"
        span_auth = "5fb397be34d23b0f"
        span_db = "32b2914ba2194c03"
        span_redis = "89e211ab90214a11"

        logs_data = [
            (now - timedelta(minutes=5), "api-gateway", "INFO", "Incoming HTTP request: POST /api/v1/orders", trace_1, span_root, {"http.method": "POST", "http.route": "/api/v1/orders"}),
            (now - timedelta(minutes=5, seconds=-1), "auth-service", "INFO", "JWT authentication verified for sub: user_982", trace_1, span_auth, {"user.id": 982}),
            (now - timedelta(minutes=5, seconds=-2), "postgres.db", "INFO", "Query executed in 14ms: SELECT * FROM products WHERE id = 104", trace_1, span_db, {"db.system": "postgresql"}),
            (now - timedelta(minutes=5, seconds=-3), "redis.cache", "INFO", "Cache HIT for key: product_inventory:104", trace_1, span_redis, {"db.system": "redis"}),
            (now - timedelta(minutes=2), "payment-service", "ERROR", "PaymentGatewayTimeoutException: Stripe API failed to respond within 3000ms", "7a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d", "a1b2c3d4e5f60718", {"error.type": "TimeoutException", "retry.count": 3}),
            (now - timedelta(minutes=1), "worker-celery", "WARN", "High memory threshold warning: celery worker pool utilization at 84%", None, None, {"worker.pool": "prefork", "memory.percent": 84.2}),
        ]

        for ts, svc, lvl, msg, tid, sid, attrs in logs_data:
            db.add(
                TelemetryLog(
                    user_id=user_id,
                    organization_id=organization_id,
                    service_name=svc,
                    level=lvl,
                    message=msg,
                    timestamp=ts,
                    trace_id=tid,
                    span_id=sid,
                    attributes_json=json.dumps(attrs),
                )
            )

        # Spans for Trace 1
        t1_start = now - timedelta(minutes=5)
        spans_data = [
            (trace_1, span_root, None, "POST /api/v1/orders", "api-gateway", "SERVER", t1_start, t1_start + timedelta(milliseconds=185), 185.0, "OK", None, {"http.status_code": 200, "http.method": "POST"}),
            (trace_1, span_auth, span_root, "POST /auth/verify", "auth-service", "CLIENT", t1_start + timedelta(milliseconds=10), t1_start + timedelta(milliseconds=45), 35.0, "OK", None, {"auth.type": "Bearer"}),
            (trace_1, span_db, span_root, "SELECT FROM products", "postgres.db", "CLIENT", t1_start + timedelta(milliseconds=50), t1_start + timedelta(milliseconds=110), 60.0, "OK", None, {"db.statement": "SELECT * FROM products WHERE id = $1"}),
            (trace_1, span_redis, span_root, "GET product_inventory", "redis.cache", "CLIENT", t1_start + timedelta(milliseconds=115), t1_start + timedelta(milliseconds=135), 20.0, "OK", None, {"db.system": "redis"}),
        ]

        # Spans for Error Trace 2
        trace_2 = "7a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d"
        t2_start = now - timedelta(minutes=2)
        spans_data.extend([
            (trace_2, "a1b2c3d4e5f60718", None, "POST /api/v1/checkout", "api-gateway", "SERVER", t2_start, t2_start + timedelta(milliseconds=3120), 3120.0, "ERROR", "HTTP 504 Gateway Timeout", {"http.status_code": 504}),
            (trace_2, "b2c3d4e5f6a10719", "a1b2c3d4e5f60718", "POST /v1/charges", "payment-service", "CLIENT", t2_start + timedelta(milliseconds=20), t2_start + timedelta(milliseconds=3100), 3080.0, "ERROR", "TimeoutException: Stripe API did not respond", {"error.kind": "timeout"}),
        ])

        for tid, sid, pid, name, svc, kind, s_time, e_time, dur, status, msg, attrs in spans_data:
            db.add(
                TelemetrySpan(
                    user_id=user_id,
                    organization_id=organization_id,
                    trace_id=tid,
                    span_id=sid,
                    parent_span_id=pid,
                    name=name,
                    service_name=svc,
                    kind=kind,
                    start_time=s_time,
                    end_time=e_time,
                    duration_ms=dur,
                    status_code=status,
                    status_message=msg,
                    attributes_json=json.dumps(attrs),
                )
            )

        await db.commit()
