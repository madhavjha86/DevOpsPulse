"""Docker Engine client and container monitoring service."""

import asyncio
import os
import re
from datetime import datetime, timezone
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.docker_host import DockerHost
from app.schemas.docker_monitoring import (
    ContainerStats,
    DockerActionResponse,
    DockerContainerItem,
    DockerContainerListResponse,
    DockerHealthResponse,
    DockerHostCreate,
    DockerHostResponse,
    DockerHostUpdate,
    DockerLogsResponse,
    DockerPortMapping,
)

logger = get_logger("docker_service")


class NamedPipeTransport(httpx.AsyncBaseTransport):
    """Custom HTTP transport communicating with Windows Named Pipe (\\.\\pipe\\docker_engine)."""

    def __init__(self, pipe_path: str = r"\\.\pipe\docker_engine"):
        self.pipe_path = pipe_path

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        def do_request() -> bytes:
            with open(self.pipe_path, "r+b", buffering=0) as f:
                path = request.url.raw_path.decode("ascii")
                headers_bytes = b""
                for k, v in request.headers.items():
                    if k.lower() not in ("host", "content-length", "connection"):
                        headers_bytes += f"{k}: {v}\r\n".encode("utf-8")

                content = request.content or b""
                req_data = (
                    f"{request.method} {path} HTTP/1.1\r\n"
                    f"Host: docker\r\n"
                    f"Connection: close\r\n"
                    f"Content-Length: {len(content)}\r\n"
                ).encode("ascii") + headers_bytes + b"\r\n" + content

                f.write(req_data)

                raw = b""
                header_part: bytes | None = None
                content_length: int | None = None
                chunked = False

                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    raw += chunk
                    if header_part is None and b"\r\n\r\n" in raw:
                        header_part, rest = raw.split(b"\r\n\r\n", 1)
                        for line in header_part.split(b"\r\n"):
                            lower = line.lower()
                            if lower.startswith(b"content-length:"):
                                content_length = int(line.split(b":")[1].strip())
                            elif lower.startswith(b"transfer-encoding:") and b"chunked" in lower:
                                chunked = True

                    if header_part is not None:
                        body_len = len(raw) - len(header_part) - 4
                        if content_length is not None and body_len >= content_length:
                            break
                        if chunked and raw.endswith(b"0\r\n\r\n"):
                            break
                return raw

        raw = await asyncio.to_thread(do_request)
        if b"\r\n\r\n" not in raw:
            return httpx.Response(status_code=502, request=request)

        header_bytes, body_bytes = raw.split(b"\r\n\r\n", 1)
        lines = header_bytes.split(b"\r\n")
        status_line = lines[0].decode("latin1")
        parts = status_line.split(" ")
        status_code = int(parts[1]) if len(parts) > 1 else 200

        response_headers: list[tuple[str, str]] = []
        for line in lines[1:]:
            if b":" in line:
                k, v = line.split(b":", 1)
                response_headers.append((k.strip().decode("latin1"), v.strip().decode("latin1")))

        is_chunked = any(k.lower() == "transfer-encoding" and "chunked" in v.lower() for k, v in response_headers)
        if is_chunked:
            clean_body = b""
            rem = body_bytes
            while rem:
                if b"\r\n" not in rem:
                    break
                len_str, rem = rem.split(b"\r\n", 1)
                try:
                    c_len = int(len_str.strip().split(b";")[0], 16)
                except ValueError:
                    break
                if c_len == 0:
                    break
                clean_body += rem[:c_len]
                rem = rem[c_len + 2 :]
            body_bytes = clean_body

        return httpx.Response(
            status_code=status_code,
            headers=response_headers,
            content=body_bytes,
            request=request,
        )


class DockerService:
    """Manages Docker host endpoints and monitors container states & metrics."""

    @staticmethod
    def _normalize_host_url(url: str, tls: bool = False) -> str:
        """Convert tcp:// or host:port into standard http:// or https:// URL."""
        trimmed = url.strip()
        if trimmed.startswith("tcp://"):
            protocol = "https://" if tls else "http://"
            return protocol + trimmed[6:]
        if not trimmed.startswith("http://") and not trimmed.startswith("https://") and not trimmed.startswith("unix://") and not trimmed.startswith("npipe://"):
            protocol = "https://" if tls else "http://"
            return protocol + trimmed
        return trimmed

    @classmethod
    def _get_client_kwargs(cls, host: DockerHost) -> dict:
        """Construct transport configuration for Named Pipe, Unix socket, or HTTP endpoint."""
        url = host.host_url.strip()

        # Check for Windows named pipe
        if url.startswith("npipe://") or url.startswith("\\\\.\\pipe\\") or url.startswith("//./pipe/"):
            pipe_path = r"\\.\pipe\docker_engine"
            if url.startswith("npipe://"):
                extracted = url[8:].replace("/", "\\").lstrip("\\")
                if extracted.lower().startswith(".\\pipe\\"):
                    pipe_path = "\\\\" + extracted
                elif extracted.lower().startswith("pipe\\"):
                    pipe_path = "\\\\.\\" + extracted
                else:
                    pipe_path = "\\\\.\\pipe\\" + extracted
            elif url.startswith("//./pipe/"):
                pipe_path = "\\\\.\\pipe\\" + url[10:].replace("/", "\\")
            elif url.startswith("\\\\.\\pipe\\"):
                pipe_path = url
            return {
                "transport": NamedPipeTransport(pipe_path=pipe_path),
                "base_url": "http://docker",
                "timeout": 5.0,
            }

        # On Windows, if host_url is localhost:2375 or 127.0.0.1:2375, check if named pipe is available
        if os.name == "nt" and ("localhost:2375" in url or "127.0.0.1:2375" in url or "default" in url):
            pipe_path = r"\\.\pipe\docker_engine"
            try:
                with open(pipe_path, "r+b", buffering=0) as _:
                    pass
                return {
                    "transport": NamedPipeTransport(pipe_path=pipe_path),
                    "base_url": "http://docker",
                    "timeout": 5.0,
                }
            except Exception:
                pass

        normalized = cls._normalize_host_url(url, host.tls_verify)
        if normalized.startswith("unix://"):
            socket_path = normalized[7:]
            return {
                "transport": httpx.AsyncHTTPTransport(uds=socket_path),
                "base_url": "http://docker",
                "timeout": 3.0,
            }
        return {
            "base_url": normalized,
            "verify": host.tls_verify,
            "timeout": 3.0,
        }

    @classmethod
    async def get_user_hosts(
        cls, db: AsyncSession, user_id: int, organization_id: int | None = None
    ) -> list[DockerHostResponse]:
        """Fetch all configured Docker hosts for a workspace."""
        stmt = select(DockerHost)
        if organization_id is not None:
            stmt = stmt.where(DockerHost.organization_id == organization_id)
        else:
            stmt = stmt.where(DockerHost.user_id == user_id)
        stmt = stmt.order_by(DockerHost.created_at.desc())
        res = await db.execute(stmt)
        hosts = res.scalars().all()
        return [DockerHostResponse.model_validate(h) for h in hosts]

    @classmethod
    async def get_host_by_id(
        cls, db: AsyncSession, host_id: int, user_id: int, organization_id: int | None = None
    ) -> DockerHost | None:
        """Fetch a specific Docker host owned by workspace."""
        stmt = select(DockerHost).where(DockerHost.id == host_id)
        if organization_id is not None:
            stmt = stmt.where(DockerHost.organization_id == organization_id)
        else:
            stmt = stmt.where(DockerHost.user_id == user_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def create_host(
        cls,
        db: AsyncSession,
        user_id: int,
        payload: DockerHostCreate,
        organization_id: int | None = None,
    ) -> DockerHostResponse:
        """Register a new Docker host endpoint."""
        host = DockerHost(
            organization_id=organization_id,
            user_id=user_id,
            name=payload.name.strip(),
            host_url=payload.host_url.strip(),
            tls_verify=payload.tls_verify,
            is_active=True,
            last_status="unknown",
        )
        db.add(host)
        await db.commit()
        await db.refresh(host)

        # Trigger initial health probe asynchronously
        await cls.check_host_health(db, host)
        await db.refresh(host)
        return DockerHostResponse.model_validate(host)

    @classmethod
    async def update_host(
        cls, db: AsyncSession, host: DockerHost, payload: DockerHostUpdate
    ) -> DockerHostResponse:
        """Update Docker host details."""
        if payload.name is not None:
            host.name = payload.name.strip()
        if payload.host_url is not None:
            host.host_url = payload.host_url.strip()
        if payload.is_active is not None:
            host.is_active = payload.is_active
        if payload.tls_verify is not None:
            host.tls_verify = payload.tls_verify

        await db.commit()
        await db.refresh(host)
        return DockerHostResponse.model_validate(host)

    @classmethod
    async def delete_host(cls, db: AsyncSession, host: DockerHost) -> bool:
        """Remove a configured Docker host."""
        await db.delete(host)
        await db.commit()
        return True

    @classmethod
    async def check_host_health(cls, db: AsyncSession, host: DockerHost) -> DockerHealthResponse:
        """Probe Docker daemon health and retrieve server specifications."""
        client_kwargs = cls._get_client_kwargs(host)
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                info_resp = await client.get("/v1.45/info")
                if info_resp.status_code == 200:
                    info_data = info_resp.json()
                    version = info_data.get("ServerVersion", "Unknown")
                    os_type = info_data.get("OperatingSystem", "Unknown")
                    arch = info_data.get("Architecture", "Unknown")
                    total = info_data.get("Containers", 0)
                    running = info_data.get("ContainersRunning", 0)
                    stopped = info_data.get("ContainersStopped", 0)
                    paused = info_data.get("ContainersPaused", 0)

                    # Update host state
                    host.last_status = "connected"
                    host.server_version = version
                    host.containers_count = total
                    host.last_connected_at = datetime.now(timezone.utc)
                    host.error_message = None
                    await db.commit()

                    return DockerHealthResponse(
                        status="connected",
                        connected=True,
                        server_version=version,
                        os=os_type,
                        architecture=arch,
                        containers_total=total,
                        containers_running=running,
                        containers_stopped=stopped,
                        containers_paused=paused,
                    )
                else:
                    err_msg = f"HTTP {info_resp.status_code}: {info_resp.text[:200]}"
                    host.last_status = "error"
                    host.error_message = err_msg
                    await db.commit()
                    return DockerHealthResponse(
                        status="error",
                        connected=False,
                        error_message=err_msg,
                    )
        except Exception as exc:
            err_msg = (
                f"Connection failed to {host.host_url}. "
                f"Ensure Docker daemon is running and reachable: {type(exc).__name__}"
            )
            logger.warning("Docker daemon connection failed", host_id=host.id, error=str(exc))
            host.last_status = "unreachable"
            host.error_message = err_msg
            await db.commit()
            return DockerHealthResponse(
                status="unreachable",
                connected=False,
                error_message=err_msg,
            )

    @classmethod
    async def get_containers(
        cls, db: AsyncSession, host: DockerHost
    ) -> DockerContainerListResponse:
        """List all containers with states and live telemetry metrics."""
        client_kwargs = cls._get_client_kwargs(host)
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                resp = await client.get("/v1.45/containers/json?all=1")
                if resp.status_code != 200:
                    host.last_status = "error"
                    host.error_message = f"Failed to list containers: HTTP {resp.status_code}"
                    await db.commit()
                    return DockerContainerListResponse(
                        host_id=host.id,
                        host_name=host.name,
                        host_status=host.last_status,
                        total_containers=0,
                        running_count=0,
                        stopped_count=0,
                        paused_count=0,
                        containers=[],
                    )

                raw_containers = resp.json()
                containers: list[DockerContainerItem] = []
                running_c = 0
                stopped_c = 0
                paused_c = 0

                for c in raw_containers:
                    c_id = c.get("Id", "")[:12]
                    raw_names = c.get("Names", ["/unnamed"])
                    clean_name = raw_names[0].lstrip("/") if raw_names else "unnamed"
                    image = c.get("Image", "unknown")
                    state = c.get("State", "unknown").lower()
                    status_str = c.get("Status", "")
                    created_ts = c.get("Created", 0)
                    created_dt = (
                        datetime.fromtimestamp(created_ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                        if created_ts
                        else "Unknown"
                    )

                    if state == "running":
                        running_c += 1
                    elif state == "paused":
                        paused_c += 1
                    else:
                        stopped_c += 1

                    # Port mappings
                    ports: list[DockerPortMapping] = []
                    for p in c.get("Ports", []):
                        ports.append(
                            DockerPortMapping(
                                host_ip=p.get("IP"),
                                host_port=p.get("PublicPort"),
                                container_port=p.get("PrivatePort", 0),
                                protocol=p.get("Type", "tcp"),
                            )
                        )

                    # Quick stats snapshot for running containers
                    stats_snap: ContainerStats | None = None
                    if state == "running":
                        try:
                            stats_resp = await client.get(
                                f"/v1.45/containers/{c.get('Id')}/stats?stream=false"
                            )
                            if stats_resp.status_code == 200:
                                sdata = stats_resp.json()
                                stats_snap = cls._calculate_stats(sdata)
                        except Exception:
                            pass

                    containers.append(
                        DockerContainerItem(
                            id=c_id,
                            name=clean_name,
                            image=image,
                            state=state,
                            status=status_str,
                            created=created_dt,
                            ports=ports,
                            stats=stats_snap,
                        )
                    )

                host.last_status = "connected"
                host.containers_count = len(containers)
                host.last_connected_at = datetime.now(timezone.utc)
                host.error_message = None
                await db.commit()

                return DockerContainerListResponse(
                    host_id=host.id,
                    host_name=host.name,
                    host_status="connected",
                    total_containers=len(containers),
                    running_count=running_c,
                    stopped_count=stopped_c,
                    paused_count=paused_c,
                    containers=containers,
                )
        except Exception as exc:
            host.last_status = "unreachable"
            host.error_message = f"Connection error: {type(exc).__name__}"
            await db.commit()
            return DockerContainerListResponse(
                host_id=host.id,
                host_name=host.name,
                host_status="unreachable",
                total_containers=0,
                running_count=0,
                stopped_count=0,
                paused_count=0,
                containers=[],
            )

    @staticmethod
    def _calculate_stats(sdata: dict) -> ContainerStats:
        """Parse raw Docker stats JSON into CPU % and memory metrics."""
        cpu_percent = 0.0
        try:
            cpu_stats = sdata.get("cpu_stats", {})
            precpu_stats = sdata.get("precpu_stats", {})
            cpu_delta = (
                cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
                - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
            )
            system_delta = (
                cpu_stats.get("system_cpu_usage", 0)
                - precpu_stats.get("system_cpu_usage", 0)
            )
            online_cpus = cpu_stats.get("online_cpus", 1) or 1
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = round((cpu_delta / system_delta) * online_cpus * 100.0, 2)
        except Exception:
            cpu_percent = 0.0

        mem_usage_mb = 0.0
        mem_limit_mb = 0.0
        mem_percent = 0.0
        try:
            memory_stats = sdata.get("memory_stats", {})
            usage = memory_stats.get("usage", 0)
            limit = memory_stats.get("limit", 1)
            mem_usage_mb = round(usage / (1024 * 1024), 2)
            mem_limit_mb = round(limit / (1024 * 1024), 2)
            if limit > 0:
                mem_percent = round((usage / limit) * 100.0, 2)
        except Exception:
            pass

        rx_mb = 0.0
        tx_mb = 0.0
        try:
            networks = sdata.get("networks", {})
            for net in networks.values():
                rx_mb += net.get("rx_bytes", 0) / (1024 * 1024)
                tx_mb += net.get("tx_bytes", 0) / (1024 * 1024)
            rx_mb = round(rx_mb, 2)
            tx_mb = round(tx_mb, 2)
        except Exception:
            pass

        return ContainerStats(
            cpu_percent=cpu_percent,
            memory_usage_mb=mem_usage_mb,
            memory_limit_mb=mem_limit_mb,
            memory_percent=mem_percent,
            network_rx_mb=rx_mb,
            network_tx_mb=tx_mb,
        )

    @classmethod
    async def get_container_logs(
        cls, host: DockerHost, container_id: str, tail: int = 100
    ) -> DockerLogsResponse:
        """Retrieve recent stdout and stderr logs for a container."""
        client_kwargs = cls._get_client_kwargs(host)
        async with httpx.AsyncClient(**client_kwargs) as client:
            resp = await client.get(
                f"/v1.45/containers/{container_id}/logs",
                params={"stdout": "true", "stderr": "true", "tail": str(tail), "timestamps": "true"},
            )
            if resp.status_code != 200:
                return DockerLogsResponse(
                    container_id=container_id,
                    lines=[f"Error fetching logs: HTTP {resp.status_code} {resp.text}"],
                    total_lines=1,
                )

            # Docker logs contain 8-byte headers for multiplexed streams
            raw_text = resp.content.decode("utf-8", errors="replace")
            # Strip non-printable ASCII multiplex headers if present
            cleaned = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", raw_text)
            lines = [line for line in cleaned.split("\n") if line.strip()]
            return DockerLogsResponse(
                container_id=container_id,
                lines=lines,
                total_lines=len(lines),
            )

    @classmethod
    async def execute_container_action(
        cls, host: DockerHost, container_id: str, action: str
    ) -> DockerActionResponse:
        """Trigger container start, stop, restart, pause, or unpause."""
        endpoint = f"/v1.45/containers/{container_id}/{action}"
        client_kwargs = cls._get_client_kwargs(host)
        async with httpx.AsyncClient(**client_kwargs) as client:
            resp = await client.post(endpoint)
            if resp.status_code in (204, 200, 304):
                state_map = {
                    "start": "running",
                    "stop": "exited",
                    "restart": "running",
                    "pause": "paused",
                    "unpause": "running",
                }
                return DockerActionResponse(
                    success=True,
                    message=f"Container successfully {action}ed.",
                    container_id=container_id,
                    new_state=state_map.get(action),
                )
            return DockerActionResponse(
                success=False,
                message=f"Failed to {action} container: HTTP {resp.status_code} {resp.text[:200]}",
                container_id=container_id,
            )
