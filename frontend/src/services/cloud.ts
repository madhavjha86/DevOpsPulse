import api from './api';

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export interface CloudAccount {
  id: number;
  user_id: number;
  provider: CloudProvider;
  name: string;
  region: string;
  masked_identifier: string;
  last_status: 'connected' | 'unconfigured' | 'unreachable' | 'auth_error';
  last_sync_at: string | null;
  resources_count: number;
  error_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudResourceItem {
  id: string;
  name: string;
  type: string;
  status: string;
  region: string;
  spec: string;
  metrics: Record<string, number>;
}

export interface CloudOverview {
  account_id: number;
  provider: CloudProvider;
  account_name: string;
  status: string;
  total_vms: number;
  running_vms: number;
  total_databases: number;
  total_serverless: number;
  estimated_monthly_cost: number;
  resources: CloudResourceItem[];
}

export interface CloudMetrics {
  account_id: number;
  provider: string;
  timestamps: string[];
  cpu_utilization: number[];
  network_io_mb: number[];
  estimated_monthly_cost_usd: number;
}

export const cloudService = {
  getAccounts: async (): Promise<CloudAccount[]> => {
    const res = await api.get<CloudAccount[]>('/api/v1/infrastructure/cloud/accounts');
    return res.data;
  },

  createAccount: async (payload: {
    provider: CloudProvider;
    name: string;
    region?: string;
    aws_access_key_id?: string;
    aws_secret_access_key?: string;
    azure_subscription_id?: string;
    azure_tenant_id?: string;
    azure_client_id?: string;
    azure_client_secret?: string;
    gcp_project_id?: string;
    gcp_service_account_json?: string;
  }): Promise<CloudAccount> => {
    const res = await api.post<CloudAccount>('/api/v1/infrastructure/cloud/accounts', payload);
    return res.data;
  },

  updateAccount: async (id: number, payload: Partial<CloudAccount>): Promise<CloudAccount> => {
    const res = await api.put<CloudAccount>(`/api/v1/infrastructure/cloud/accounts/${id}`, payload);
    return res.data;
  },

  deleteAccount: async (id: number): Promise<void> => {
    await api.delete(`/api/v1/infrastructure/cloud/accounts/${id}`);
  },

  checkHealth: async (id: number): Promise<Record<string, unknown>> => {
    const res = await api.get(`/api/v1/infrastructure/cloud/accounts/${id}/health`);
    return res.data;
  },

  getOverview: async (id: number): Promise<CloudOverview> => {
    const res = await api.get<CloudOverview>(`/api/v1/infrastructure/cloud/accounts/${id}/overview`);
    return res.data;
  },

  getMetrics: async (id: number): Promise<CloudMetrics> => {
    const res = await api.get<CloudMetrics>(`/api/v1/infrastructure/cloud/accounts/${id}/metrics`);
    return res.data;
  },
};
