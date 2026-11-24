import api from './api';

export interface GitOpsDriftItem {
  resource_kind: string;
  resource_name: string;
  namespace: string;
  diff_field: string;
  git_value: string;
  live_k8s_value: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface GitOpsApp {
  id: string;
  name: string;
  git_repo: string;
  git_branch: string;
  git_path: string;
  cluster_name: string;
  namespace: string;
  sync_status: 'Synced' | 'OutOfSync' | 'DriftDetected';
  health_status: 'Healthy' | 'Degraded' | 'Progressing';
  target_revision: string;
  live_revision: string;
  last_synced_at: string;
  drifts: GitOpsDriftItem[];
}

export interface GitOpsSyncRequest {
  prune?: boolean;
  dry_run?: boolean;
}

export interface GitOpsSyncResponse {
  sync_id: string;
  status: 'SUCCESS' | 'FAILED' | 'DRY_RUN';
  synced_resources: number;
  message: string;
  timestamp: string;
}

export interface CanaryRollout {
  app_id: string;
  service_name: string;
  canary_weight: number;
  baseline_weight: number;
  status: 'RUNNING' | 'PAUSED' | 'PROMOTED' | 'ABORTED';
  canary_image: string;
  baseline_image: string;
  http_error_rate_canary: number;
  http_error_rate_baseline: number;
  p99_latency_canary_ms: number;
  p99_latency_baseline_ms: number;
  step_history: string[];
}

export interface CanaryAdjustRequest {
  weight?: number;
  action: 'SET_WEIGHT' | 'PROMOTE' | 'ROLLBACK';
}

export const gitopsApi = {
  listApps: async (): Promise<GitOpsApp[]> => {
    const res = await api.get<GitOpsApp[]>('/api/v1/gitops/apps');
    return res.data;
  },
  getApp: async (appId: string): Promise<GitOpsApp> => {
    const res = await api.get<GitOpsApp>(`/api/v1/gitops/apps/${appId}`);
    return res.data;
  },
  syncApp: async (appId: string, req: GitOpsSyncRequest = {}): Promise<GitOpsSyncResponse> => {
    const res = await api.post<GitOpsSyncResponse>(`/api/v1/gitops/apps/${appId}/sync`, req);
    return res.data;
  },
  getCanary: async (appId: string): Promise<CanaryRollout> => {
    const res = await api.get<CanaryRollout>(`/api/v1/gitops/apps/${appId}/canary`);
    return res.data;
  },
  adjustCanary: async (appId: string, req: CanaryAdjustRequest): Promise<CanaryRollout> => {
    const res = await api.post<CanaryRollout>(`/api/v1/gitops/apps/${appId}/canary/adjust`, req);
    return res.data;
  },
};
