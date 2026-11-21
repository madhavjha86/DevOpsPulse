"""Enterprise AI Gateway and Reverse Proxy Service for Cursor, Claude Code, and Codex.

Acts as a central corporate gateway to audit, attribute, and enforce quotas
on external developer AI tools.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import decode_token
from app.models.ai_governance import AITokenLedger, AIUserQuota
from app.models.organization import OrganizationMember
from app.models.user import User
from app.services.ai_governance_service import AIGovernanceService

logger = get_logger("ai_proxy_service")
settings = get_settings()


class AIProxyService:
    """Universal Enterprise AI Gateway and Reverse Proxy."""

    @classmethod
    async def resolve_user_and_org(
        cls, request: Request, db: AsyncSession
    ) -> tuple[int, int, str]:
        """Resolve the caller's user_id, organization_id, and email from request headers."""
        user_email = (
            request.headers.get("X-User-Email")
            or request.headers.get("x-user-email")
            or request.headers.get("X-Employee-Email")
        )
        header_org = (
            request.headers.get("X-Organization-Id")
            or request.headers.get("x-organization-id")
        )
        forced_org_id = int(header_org) if header_org and header_org.isdigit() else None

        auth_header = request.headers.get("Authorization") or request.headers.get("x-api-key") or ""
        token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else auth_header.strip()

        # 1. Try resolving via email header
        if user_email:
            res = await db.execute(select(User).where(User.email == user_email.strip().lower()))
            u = res.scalar_one_or_none()
            if u:
                if forced_org_id:
                    return u.id, forced_org_id, u.email
                org_res = await db.execute(
                    select(OrganizationMember.organization_id).where(OrganizationMember.user_id == u.id)
                )
                org_id = org_res.scalars().first() or 1
                return u.id, org_id, u.email

        # 2. Try resolving via Bearer token
        if token:
            if "@" in token:
                res = await db.execute(select(User).where(User.email == token.lower()))
                u = res.scalar_one_or_none()
                if u:
                    if forced_org_id:
                        return u.id, forced_org_id, u.email
                    org_res = await db.execute(
                        select(OrganizationMember.organization_id).where(OrganizationMember.user_id == u.id)
                    )
                    org_id = org_res.scalars().first() or 1
                    return u.id, org_id, u.email
            elif token.startswith("eyJ"):
                try:
                    payload = decode_token(token)
                    sub = payload.get("sub")
                    if sub:
                        user_query = (
                            select(User).where(User.id == int(sub))
                            if str(sub).isdigit()
                            else select(User).where(User.email == str(sub))
                        )
                        res = await db.execute(user_query)
                        u = res.scalar_one_or_none()
                        if u:
                            if forced_org_id:
                                return u.id, forced_org_id, u.email
                            org_res = await db.execute(
                                select(OrganizationMember.organization_id).where(OrganizationMember.user_id == u.id)
                            )
                            org_id = org_res.scalars().first() or 1
                            return u.id, org_id, u.email
                except Exception:
                    pass

        # 3. Fallback to first active user in workspace
        default_res = await db.execute(select(User).where(User.is_active.is_(True)).order_by(User.id.asc()))
        default_user = default_res.scalar_one_or_none()
        if default_user:
            if forced_org_id:
                return default_user.id, forced_org_id, default_user.email
            org_res = await db.execute(
                select(OrganizationMember.organization_id).where(OrganizationMember.user_id == default_user.id)
            )
            org_id = org_res.scalars().first() or 1
            return default_user.id, org_id, default_user.email

        return 1, forced_org_id or 1, "developer@company.com"

    @classmethod
    async def check_quota_guardrail(
        cls, db: AsyncSession, organization_id: int, user_id: int
    ) -> tuple[bool, str | None]:
        """Check if employee has crossed monthly cost or token ceiling with BLOCK enforcement."""
        q_stmt = select(AIUserQuota).where(
            AIUserQuota.organization_id == organization_id,
            AIUserQuota.user_id == user_id,
        )
        q_res = await db.execute(q_stmt)
        quota = q_res.scalar_one_or_none()

        if not quota or quota.enforcement_action != "BLOCK":
            return True, None

        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        spend_stmt = select(func.coalesce(func.sum(AITokenLedger.estimated_cost_usd), 0.0)).where(
            AITokenLedger.organization_id == organization_id,
            AITokenLedger.user_id == user_id,
            AITokenLedger.created_at >= start_of_month,
        )
        spend_res = await db.execute(spend_stmt)
        curr_spend = float(spend_res.scalar() or 0.0)

        if curr_spend >= quota.monthly_cost_limit_usd:
            msg = (
                f"DevOpsPulse Enterprise Policy: Monthly AI budget limit of ${quota.monthly_cost_limit_usd:.2f} "
                f"reached (current: ${curr_spend:.2f}). Access temporarily blocked. Contact your DevOpsPulse admin."
            )
            return False, msg

        return True, None

    @classmethod
    def detect_tool_name(cls, request: Request) -> str:
        """Infer tool client name (Cursor, Claude Code, Codex) from headers."""
        ua = (request.headers.get("User-Agent") or request.headers.get("user-agent") or "").lower()
        if "cursor" in ua:
            return "Cursor IDE"
        if "claude" in ua or "anthropic" in ua:
            return "Claude Code"
        if "codex" in ua or "copilot" in ua:
            return "OpenAI Codex"
        if "continue" in ua:
            return "Continue.dev"
        if "cline" in ua:
            return "Cline VSCode"
        return "Cursor IDE"

    @classmethod
    def get_models_catalog(cls) -> dict[str, Any]:
        """Return OpenAI-compliant models catalog for IDE discovery."""
        return {
            "object": "list",
            "data": [
                {"id": "gpt-4o", "object": "model", "owned_by": "openai"},
                {"id": "gpt-4o-mini", "object": "model", "owned_by": "openai"},
                {"id": "claude-3-5-sonnet", "object": "model", "owned_by": "anthropic"},
                {"id": "claude-3-7-sonnet", "object": "model", "owned_by": "anthropic"},
                {"id": "openai/gpt-oss-120b", "object": "model", "owned_by": "groq"},
                {"id": "llama-3.3-70b-versatile", "object": "model", "owned_by": "groq"},
                {"id": "llama-3.1-8b-instant", "object": "model", "owned_by": "groq"},
            ],
        }

    @classmethod
    async def handle_chat_completions(
        cls, request_body: dict[str, Any], request: Request, db: AsyncSession
    ) -> Response:
        """Proxy OpenAI-compatible chat completion requests with live token attribution."""
        user_id, org_id, email = await cls.resolve_user_and_org(request, db)

        # Quota check
        allowed, block_msg = await cls.check_quota_guardrail(db, org_id, user_id)
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": {
                        "message": block_msg,
                        "type": "insufficient_quota",
                        "code": "quota_exceeded",
                    }
                },
            )

        tool_name = cls.detect_tool_name(request)
        provider = (settings.AI_PROVIDER or "openai").lower().strip()
        api_key = settings.AI_API_KEY or ""
        base_url = (settings.AI_BASE_URL or "").rstrip("/")

        # Determine upstream target
        if provider == "groq":
            target_url = f"{base_url}/chat/completions" if base_url else "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        elif provider == "gemini":
            target_url = f"{base_url}/chat/completions" if base_url else "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        elif provider == "ollama":
            target_url = f"{base_url}/chat/completions" if base_url else "http://localhost:11434/v1/chat/completions"
            headers = {"Content-Type": "application/json"}
        else:
            target_url = f"{base_url}/chat/completions" if base_url else "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Prepare payload: adjust model if upstream is Groq and model not present
        req_model = request_body.get("model", settings.AI_MODEL)
        upstream_payload = dict(request_body)

        if provider == "groq":
            # Map gpt-4o or claude-3-5-sonnet to Groq's high performance model if running Groq
            if "gpt-4" in req_model or "claude" in req_model or "sonnet" in req_model:
                upstream_payload["model"] = settings.AI_MODEL or "openai/gpt-oss-120b"

        is_stream = bool(upstream_payload.get("stream", False))
        start_time = time.time()

        # Non-streaming request
        if not is_stream:
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    resp = await client.post(target_url, json=upstream_payload, headers=headers)
                    resp_data = resp.json()
                except Exception as e:
                    logger.error("Error proxying LLM request", error=str(e), target=target_url)
                    return JSONResponse(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        content={"error": {"message": f"DevOpsPulse AI Gateway Upstream Error: {e}", "type": "gateway_error"}},
                    )

            latency_ms = int((time.time() - start_time) * 1000)

            # Record usage from response
            usage = resp_data.get("usage") or {}
            prompt_tokens = usage.get("prompt_tokens") or 0
            completion_tokens = usage.get("completion_tokens") or 0

            # Estimate if usage missing
            if prompt_tokens == 0 and completion_tokens == 0:
                prompt_text = "".join(str(m.get("content", "")) for m in upstream_payload.get("messages", []))
                prompt_tokens = max(1, len(prompt_text) // 4)
                choices = resp_data.get("choices", [])
                out_text = choices[0].get("message", {}).get("content", "") if choices else ""
                completion_tokens = max(1, len(out_text) // 4)

            await AIGovernanceService.record_usage(
                db=db,
                organization_id=org_id,
                user_id=user_id,
                tool_name=tool_name,
                provider=provider,
                model_name=req_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                latency_ms=latency_ms,
                status="SUCCESS" if resp.status_code == 200 else "ERROR",
                client_metadata={"client_email": email, "proxy_target": target_url},
            )

            return JSONResponse(content=resp_data, status_code=resp.status_code)

        # Streaming request (SSE text/event-stream)
        async def stream_generator() -> AsyncGenerator[bytes, None]:
            accumulated_text = []
            prompt_text = "".join(str(m.get("content", "")) for m in upstream_payload.get("messages", []))
            prompt_tokens = max(1, len(prompt_text) // 4)
            completion_tokens = 0

            client = httpx.AsyncClient(timeout=120.0)
            try:
                async with client.stream("POST", target_url, json=upstream_payload, headers=headers) as upstream_resp:
                    async for chunk in upstream_resp.aiter_bytes():
                        yield chunk
                        # Extract chunk tokens
                        try:
                            decoded = chunk.decode("utf-8", errors="ignore")
                            for line in decoded.splitlines():
                                if line.startswith("data: ") and not line.endswith("[DONE]"):
                                    c_data = json.loads(line[6:])
                                    # Usage if sent by provider in final stream chunk
                                    if "usage" in c_data and c_data["usage"]:
                                        prompt_tokens = c_data["usage"].get("prompt_tokens", prompt_tokens)
                                        completion_tokens = c_data["usage"].get("completion_tokens", completion_tokens)
                                    delta = c_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if delta:
                                        accumulated_text.append(delta)
                        except Exception:
                            pass
            finally:
                await client.aclose()
                latency_ms = int((time.time() - start_time) * 1000)
                if completion_tokens == 0:
                    completion_tokens = max(1, sum(len(t) for t in accumulated_text) // 4)

                try:
                    await AIGovernanceService.record_usage(
                        db=db,
                        organization_id=org_id,
                        user_id=user_id,
                        tool_name=tool_name,
                        provider=provider,
                        model_name=req_model,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        latency_ms=latency_ms,
                        status="SUCCESS",
                        client_metadata={"client_email": email, "streaming": True},
                    )
                except Exception as log_err:
                    logger.error("Failed recording streaming token ledger", error=str(log_err))

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    @classmethod
    async def handle_anthropic_messages(
        cls, request_body: dict[str, Any], request: Request, db: AsyncSession
    ) -> Response:
        """Proxy Anthropic-compatible /v1/messages for Claude Code CLI."""
        user_id, org_id, email = await cls.resolve_user_and_org(request, db)

        # Quota check
        allowed, block_msg = await cls.check_quota_guardrail(db, org_id, user_id)
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "type": "error",
                    "error": {
                        "type": "rate_limit_error",
                        "message": block_msg,
                    },
                },
            )

        provider = (settings.AI_PROVIDER or "openai").lower().strip()
        api_key = settings.AI_API_KEY or ""
        req_model = request_body.get("model", "claude-3-5-sonnet")
        start_time = time.time()

        # If Anthropic provider is configured, forward directly
        if provider == "anthropic":
            target_url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(target_url, json=request_body, headers=headers)
                resp_data = resp.json()

            latency_ms = int((time.time() - start_time) * 1000)
            usage = resp_data.get("usage") or {}
            p_tokens = usage.get("input_tokens", 100)
            c_tokens = usage.get("output_tokens", 50)

            await AIGovernanceService.record_usage(
                db=db,
                organization_id=org_id,
                user_id=user_id,
                tool_name="Claude Code",
                provider="anthropic",
                model_name=req_model,
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                latency_ms=latency_ms,
                status="SUCCESS" if resp.status_code == 200 else "ERROR",
                client_metadata={"client_email": email},
            )
            return JSONResponse(content=resp_data, status_code=resp.status_code)

        # Otherwise translate Anthropic format to OpenAI/Groq format so Claude Code works with any configured LLM
        messages = []
        system_prompt = request_body.get("system")
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        for m in request_body.get("messages", []):
            content = m.get("content")
            if isinstance(content, list):
                text_content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
            else:
                text_content = str(content or "")
            messages.append({"role": m.get("role", "user"), "content": text_content})

        openai_req = {
            "model": settings.AI_MODEL or "openai/gpt-oss-120b",
            "messages": messages,
            "max_tokens": request_body.get("max_tokens", 2048),
            "temperature": request_body.get("temperature", 0.2),
        }

        # Send to configured OpenAI/Groq backend
        groq_url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(groq_url, json=openai_req, headers=headers)
            oai_data = resp.json()

        latency_ms = int((time.time() - start_time) * 1000)
        choices = oai_data.get("choices", [{}])
        ans_text = choices[0].get("message", {}).get("content", "") if choices else ""
        usage = oai_data.get("usage", {})
        p_tokens = usage.get("prompt_tokens", max(1, len(str(messages)) // 4))
        c_tokens = usage.get("completion_tokens", max(1, len(ans_text) // 4))

        await AIGovernanceService.record_usage(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            tool_name="Claude Code",
            provider=provider,
            model_name=req_model,
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            latency_ms=latency_ms,
            status="SUCCESS",
            client_metadata={"client_email": email, "translated_from": "anthropic"},
        )

        # Return Anthropic-compliant message JSON
        anthropic_resp = {
            "id": f"msg_{int(time.time()*1000)}",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": ans_text}],
            "model": req_model,
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {
                "input_tokens": p_tokens,
                "output_tokens": c_tokens,
            },
        }
        return JSONResponse(content=anthropic_resp, status_code=200)
