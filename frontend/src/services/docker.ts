import api from './api';

export interface DockerHost {
  id: number;
  user_id: number;
  name: string;
  host_url: string;
  tls_verify: boolean;
  is_active: boolean;
  last_status: 'connected' | 'unreachable' | 'error' | 'unknown';
  last_connected_at: string | null;
  server_version: string | null;
  containers_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DockerPortMapping {
  host_ip: string | null;
  host_port: number | null;
  container_port: number;
  protocol: string;
}

export interface ContainerStats {
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  memory_percent: number;
  network_rx_mb: number;
  network_tx_mb: number;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string; // 'running' | 'exited' | 'restarting' | 'paused'
  status: string;
  created: string;
  ports: DockerPortMapping[];
  stats: ContainerStats | null;
}

export interface DockerContainerListResponse {
  host_id: number;
  host_name: string;
  host_status: string;
  total_containers: number;
  running_count: number;
  stopped_count: number;
  paused_count: number;
  containers: DockerContainer[];
}

export interface DockerHealthResponse {
  status: string;
  connected: boolean;
  server_version?: string;
  os?: string;
  architecture?: string;
  containers_total: number;
  containers_running: number;
  containers_stopped: number;
  containers_paused: number;
  error_message?: string;
}

export interface DockerLogsResponse {
  container_id: string;
  lines: string[];
  total_lines: number;
}

export interface DockerActionResponse {
  success: boolean;
  message: string;
  container_id: string;
  new_state?: string;
}

export const dockerService = {
  getHosts: async (): Promise<DockerHost[]> => {
    const res = await api.get<DockerHost[]>('/api/v1/infrastructure/docker/hosts');
    return res.data;
  },

  createHost: async (payload: { name: string; host_url: string; tls_verify?: boolean }): Promise<DockerHost> => {
    const res = await api.post<DockerHost>('/api/v1/infrastructure/docker/hosts', payload);
    return res.data;
  },

  updateHost: async (id: number, payload: Partial<DockerHost>): Promise<DockerHost> => {
    const res = await api.put<DockerHost>(`/api/v1/infrastructure/docker/hosts/${id}`, payload);
    return res.data;
  },

  deleteHost: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/infrastructure/docker/hosts/${id}`);
  },

  checkHealth: async (hostId: number): Promise<DockerHealthResponse> => {
    const res = await api.get<DockerHealthResponse>(`/api/v1/infrastructure/docker/hosts/${hostId}/health`);
    return res.data;
  },

  getContainers: async (hostId: number): Promise<DockerContainerListResponse> => {
    const res = await api.get<DockerContainerListResponse>(`/api/v1/infrastructure/docker/hosts/${hostId}/containers`);
    return res.data;
  },

  getLogs: async (hostId: number, containerId: string, tail: number = 100): Promise<DockerLogsResponse> => {
    const res = await api.get<DockerLogsResponse>(
      `/api/v1/infrastructure/docker/hosts/${hostId}/containers/${containerId}/logs`,
      { params: { tail } }
    );
    return res.data;
  },

  executeAction: async (
    hostId: number,
    containerId: string,
    action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause'
  ): Promise<DockerActionResponse> => {
    const res = await api.post<DockerActionResponse>(
      `/api/v1/infrastructure/docker/hosts/${hostId}/containers/${containerId}/action`,
      { action }
    );
    return res.data;
  },
};
