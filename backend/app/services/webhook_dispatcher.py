"""Outbound Webhook and Alerting Dispatcher Service for Slack, Teams, Discord, and Custom Webhooks."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import time
from typing import Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization_webhook import OrganizationWebhook, WebhookTargetType

logger = logging.getLogger(__name__)


class WebhookDispatcher:
    """Service to manage and dispatch outbound notifications to Slack, Discord, Teams, and Webhooks."""

    @classmethod
    async def list_webhooks(
        cls, db: AsyncSession, organization_id: int
    ) -> list[OrganizationWebhook]:
        """List all configured alert webhooks for an organization."""
        query = (
            select(OrganizationWebhook)
            .where(OrganizationWebhook.organization_id == organization_id)
            .order_by(OrganizationWebhook.created_at.desc())
        )
        res = await db.execute(query)
        return list(res.scalars().all())

    @classmethod
    async def create_webhook(
        cls,
        db: AsyncSession,
        organization_id: int,
        name: str,
        target_type: str,
        url: str,
        events: list[str],
        secret: str | None = None,
    ) -> OrganizationWebhook:
        """Create a new outbound webhook channel."""
        events_str = ",".join(events) if events else "incident.created,incident.resolved,incident.critical"
        target_val = target_type.upper() if target_type else WebhookTargetType.SLACK.value
        if target_val not in [e.value for e in WebhookTargetType]:
            target_val = WebhookTargetType.GENERIC.value

        webhook = OrganizationWebhook(
            organization_id=organization_id,
            name=name.strip(),
            target_type=target_val,
            url=url.strip(),
            events=events_str,
            secret=secret.strip() if secret and secret.strip() else None,
            is_active=True,
            last_delivery_status="UNTESTED",
        )
        db.add(webhook)
        await db.commit()
        await db.refresh(webhook)
        logger.info(
            "Created outbound webhook %s (target=%s) for org %s",
            webhook.id,
            webhook.target_type,
            organization_id,
        )
        return webhook

    @classmethod
    async def delete_webhook(
        cls, db: AsyncSession, organization_id: int, webhook_id: int
    ) -> bool:
        """Delete a configured webhook."""
        query = select(OrganizationWebhook).where(
            OrganizationWebhook.id == webhook_id,
            OrganizationWebhook.organization_id == organization_id,
        )
        res = await db.execute(query)
        webhook = res.scalar_one_or_none()
        if not webhook:
            return False
        await db.delete(webhook)
        await db.commit()
        return True

    @classmethod
    def format_payload(
        cls,
        target_type: str,
        event_type: str,
        title: str,
        details: dict[str, Any],
    ) -> tuple[dict[str, Any], str]:
        """Format event payload for the destination platform (Slack, Discord, Teams, Generic)."""
        is_critical = "critical" in event_type.lower() or str(details.get("severity", "")).upper() == "CRITICAL"
        is_resolved = "resolved" in event_type.lower() or str(details.get("new_status", "")).upper() == "RESOLVED"

        color_hex = "#E11D48" if is_critical else ("#10B981" if is_resolved else "#7C3AED")
        color_int = 0xE11D48 if is_critical else (0x10B981 if is_resolved else 0x7C3AED)
        teams_color = "E11D48" if is_critical else ("10B981" if is_resolved else "7C3AED")

        summary_text = str(details.get("description") or details.get("resolution_notes") or details.get("message") or "")

        if target_type == WebhookTargetType.SLACK.value:
            fields = [
                {"title": k.replace("_", " ").title(), "value": str(v), "short": True}
                for k, v in details.items()
                if k not in ("description", "resolution_notes", "message")
            ]
            payload = {
                "text": f"🚨 *{title}*",
                "attachments": [
                    {
                        "color": color_hex,
                        "title": title,
                        "text": summary_text,
                        "fields": fields,
                        "footer": "DevOpsPulse Alert Engine",
                        "ts": int(time.time()),
                    }
                ],
            }
            return payload, json.dumps(payload)

        elif target_type == WebhookTargetType.DISCORD.value:
            fields = [
                {"name": k.replace("_", " ").title(), "value": str(v), "inline": True}
                for k, v in details.items()
                if k not in ("description", "resolution_notes", "message")
            ]
            payload = {
                "content": f"🚨 **{title}**",
                "embeds": [
                    {
                        "title": title,
                        "description": summary_text,
                        "color": color_int,
                        "fields": fields,
                        "footer": {"text": "DevOpsPulse Alert Engine"},
                    }
                ],
            }
            return payload, json.dumps(payload)

        elif target_type == WebhookTargetType.TEAMS.value:
            facts = [
                {"name": k.replace("_", " ").title(), "value": str(v)}
                for k, v in details.items()
                if k not in ("description", "resolution_notes", "message")
            ]
            payload = {
                "@type": "MessageCard",
                "@context": "https://schema.org/extensions",
                "summary": title,
                "themeColor": teams_color,
                "title": title,
                "sections": [
                    {
                        "activityTitle": title,
                        "activitySubtitle": f"DevOpsPulse Event: {event_type}",
                        "facts": facts,
                        "text": summary_text,
                    }
                ],
            }
            return payload, json.dumps(payload)

        else:
            # Generic JSON payload
            payload = {
                "event": event_type,
                "title": title,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": details,
            }
            return payload, json.dumps(payload)

    @classmethod
    async def send_test_ping(
        cls, db: AsyncSession, organization_id: int, webhook_id: int
    ) -> dict[str, Any]:
        """Dispatch a test ping to verify connectivity and capture HTTP latency."""
        query = select(OrganizationWebhook).where(
            OrganizationWebhook.id == webhook_id,
            OrganizationWebhook.organization_id == organization_id,
        )
        res = await db.execute(query)
        webhook = res.scalar_one_or_none()
        if not webhook:
            return {"success": False, "status_code": None, "latency_ms": 0, "message": "Webhook not found"}

        test_details = {
            "service": "DevOpsPulse Alerting Engine",
            "environment": "production",
            "status": "OPERATIONAL",
            "message": "This is a verification test ping from DevOpsPulse Alert Hub. Incoming notifications are configured properly.",
        }

        payload, payload_str = cls.format_payload(
            target_type=webhook.target_type,
            event_type="system.test_ping",
            title="DevOpsPulse Test Alert: Connection Verified",
            details=test_details,
        )

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DevOpsPulse-Alert-Bot/1.2",
            "X-DevOpsPulse-Event": "system.test_ping",
        }

        if webhook.secret:
            sig = hmac.new(
                webhook.secret.encode("utf-8"),
                payload_str.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["X-DevOpsPulse-Signature"] = f"sha256={sig}"

        start_time = time.monotonic()
        status_code: int | None = None
        error_msg: str | None = None
        success = False

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(webhook.url, content=payload_str, headers=headers)
                status_code = resp.status_code
                latency_ms = int((time.monotonic() - start_time) * 1000)
                success = 200 <= status_code < 300
                if not success:
                    error_msg = f"HTTP {status_code}: {resp.text[:200]}"
        except Exception as exc:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            error_msg = f"{exc.__class__.__name__}: {str(exc)}"

        webhook.last_status_code = status_code
        webhook.last_delivery_status = "SUCCESS" if success else "FAILED"
        webhook.last_error = error_msg
        webhook.last_dispatched_at = datetime.now(timezone.utc)
        await db.commit()

        if success:
            msg = f"Delivered test alert successfully (HTTP {status_code}) in {latency_ms}ms"
        else:
            msg = f"Delivery failed: {error_msg or f'HTTP {status_code}'}"

        return {
            "success": success,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "message": msg,
        }

    @classmethod
    async def dispatch_event(
        cls,
        db: AsyncSession,
        organization_id: int | None,
        event_type: str,
        title: str,
        details: dict[str, Any],
    ) -> int:
        """Asynchronously dispatch an event notification to all subscribed active webhooks."""
        if not organization_id:
            return 0

        query = select(OrganizationWebhook).where(
            OrganizationWebhook.organization_id == organization_id,
            OrganizationWebhook.is_active == True,  # noqa: E712
        )
        res = await db.execute(query)
        webhooks = list(res.scalars().all())
        if not webhooks:
            return 0

        dispatched_count = 0
        for wh in webhooks:
            subscribed_events = [ev.strip() for ev in wh.events.split(",") if ev.strip()]
            if event_type not in subscribed_events and "*" not in subscribed_events:
                continue

            try:
                _, payload_str = cls.format_payload(
                    target_type=wh.target_type,
                    event_type=event_type,
                    title=title,
                    details=details,
                )
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "DevOpsPulse-Alert-Bot/1.2",
                    "X-DevOpsPulse-Event": event_type,
                }
                if wh.secret:
                    sig = hmac.new(
                        wh.secret.encode("utf-8"),
                        payload_str.encode("utf-8"),
                        hashlib.sha256,
                    ).hexdigest()
                    headers["X-DevOpsPulse-Signature"] = f"sha256={sig}"

                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(wh.url, content=payload_str, headers=headers)
                    wh.last_status_code = resp.status_code
                    wh.last_delivery_status = "SUCCESS" if (200 <= resp.status_code < 300) else "FAILED"
                    wh.last_dispatched_at = datetime.now(timezone.utc)
                    dispatched_count += 1
            except Exception as exc:
                wh.last_delivery_status = "FAILED"
                wh.last_error = f"{exc.__class__.__name__}: {str(exc)}"
                wh.last_dispatched_at = datetime.now(timezone.utc)
                logger.warning("Failed to dispatch webhook %s (%s): %s", wh.id, wh.url, exc)

        try:
            await db.commit()
        except Exception:
            pass

        return dispatched_count
