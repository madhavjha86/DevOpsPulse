import api from './api';

export interface K8sCluster {
  id: number;
  user_id: number;
  name: string;
  api_server_url: string;
  auth_type: string;
  namespace_filter: string;
  tls_verify: boolean;
  is_active: boolean;
  last_status: 'connected' | 'unreachable' | 'auth_error' | 'unknown' | 'error';
  last_connected_at: string | null;
  k8s_version: string | null;
  nodes_count: number;
  pods_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface K8sNode {
  name: string;
  status: 'Ready' | 'NotReady';
  roles: string[];
  kubelet_version: string;
  os_image: string;
  architecture: string;
  cpu_capacity: string;
  memory_capacity: string;
}

export interface K8sContainerStatus {
  name: string;
  ready: boolean;
  restart_count: number;
  state: string;
  state_reason: string | null;
  state_message: string | null;
}

export interface K8sPod {
  name: string;
  namespace: string;
  node_name: string | null;
  phase: 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown';
  is_crash_loop: boolean;
  is_oom_killed: boolean;
  restarts_total: number;
  pod_ip: string | null;
  start_time: string | null;
  containers: K8sContainerStatus[];
}

export interface K8sOverview {
  cluster_id: number;
  cluster_name: string;
  cluster_status: string;
  k8s_version: string | null;
  nodes_total: number;
  nodes_ready: number;
  pods_total: number;
  pods_running: number;
  pods_pending: number;
  pods_failed: number;
  crash_loop_count: number;
  namespaces: string[];
}

export interface K8sPodLogs {
  pod_name: string;
  namespace: string;
  lines: string[];
  total_lines: number;
}

export interface K8sScaleResponse {
  success: boolean;
  message: string;
  deployment_name: string;
  target_replicas: number;
}

export const kubernetesService = {
  getClusters: async (): Promise<K8sCluster[]> => {
    const res = await api.get<K8sCluster[]>('/api/v1/infrastructure/k8s/clusters');
    return res.data;
  },

  createCluster: async (payload: {
    name: string;
    api_server_url: string;
    auth_type?: string;
    bearer_token?: string;
    namespace_filter?: string;
    tls_verify?: boolean;
  }): Promise<K8sCluster> => {
    const res = await api.post<K8sCluster>('/api/v1/infrastructure/k8s/clusters', payload);
    return res.data;
  },

  updateCluster: async (id: number, payload: Partial<K8sCluster>): Promise<K8sCluster> => {
    const res = await api.put<K8sCluster>(`/api/v1/infrastructure/k8s/clusters/${id}`, payload);
    return res.data;
  },

  deleteCluster: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/infrastructure/k8s/clusters/${id}`);
  },

  checkHealth: async (id: number): Promise<Record<string, unknown>> => {
    const res = await api.get(`/api/v1/infrastructure/k8s/clusters/${id}/health`);
    return res.data;
  },

  getOverview: async (id: number): Promise<K8sOverview> => {
    const res = await api.get<K8sOverview>(`/api/v1/infrastructure/k8s/clusters/${id}/overview`);
    return res.data;
  },

  getNodes: async (id: number): Promise<K8sNode[]> => {
    const res = await api.get<K8sNode[]>(`/api/v1/infrastructure/k8s/clusters/${id}/nodes`);
    return res.data;
  },

  getPods: async (id: number, namespace?: string): Promise<K8sPod[]> => {
    const res = await api.get<K8sPod[]>(`/api/v1/infrastructure/k8s/clusters/${id}/pods`, {
      params: namespace && namespace !== 'all' ? { namespace } : {},
    });
    return res.data;
  },

  getPodLogs: async (
    id: number,
    podName: string,
    namespace: string = 'default',
    tail: number = 100
  ): Promise<K8sPodLogs> => {
    const res = await api.get<K8sPodLogs>(
      `/api/v1/infrastructure/k8s/clusters/${id}/pods/${podName}/logs`,
      { params: { namespace, tail } }
    );
    return res.data;
  },

  scaleDeployment: async (
    id: number,
    deploymentName: string,
    replicas: number,
    namespace: string = 'default'
  ): Promise<K8sScaleResponse> => {
    const res = await api.post<K8sScaleResponse>(
      `/api/v1/infrastructure/k8s/clusters/${id}/deployments/${deploymentName}/scale`,
      { replicas },
      { params: { namespace } }
    );
    return res.data;
  },
};
