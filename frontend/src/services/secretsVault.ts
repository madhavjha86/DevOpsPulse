import api from './api';

export interface SecretItem {
  id: string;
  key: string;
  value_masked: string;
  environment: 'development' | 'staging' | 'production';
  category: 'API_KEY' | 'DATABASE_URL' | 'SSH_KEY' | 'CERTIFICATE' | 'OAUTH_TOKEN';
  version: number;
  is_leaked: boolean;
  last_rotated_at: string;
  created_at: string;
}

export interface SecretCreateRequest {
  key: string;
  value: string;
  environment: 'development' | 'staging' | 'production';
  category: 'API_KEY' | 'DATABASE_URL' | 'SSH_KEY' | 'CERTIFICATE' | 'OAUTH_TOKEN';
}

export interface SecretRevealResponse {
  key: string;
  value: string;
  environment: string;
}

export interface SecretLeakFinding {
  file_path: string;
  line_number: number;
  secret_type: string;
  snippet_masked: string;
  severity: 'high' | 'critical';
}

export interface SecretLeakScanResult {
  scanned_files_count: number;
  detected_leaks_count: number;
  findings: SecretLeakFinding[];
  scanned_at: string;
}

export interface SecretSyncK8sRequest {
  environment: 'development' | 'staging' | 'production';
  namespace?: string;
  secret_name?: string;
}

export interface SecretSyncK8sResponse {
  status: string;
  injected_keys_count: number;
  k8s_secret_name: string;
  namespace: string;
  duration_ms: number;
}

export const secretsVaultApi = {
  listSecrets: async (environment?: string): Promise<SecretItem[]> => {
    const res = await api.get<SecretItem[]>('/api/v1/secrets/vault', { params: { environment } });
    return res.data;
  },
  createSecret: async (req: SecretCreateRequest): Promise<SecretItem> => {
    const res = await api.post<SecretItem>('/api/v1/secrets/vault', req);
    return res.data;
  },
  revealSecret: async (secretId: string): Promise<SecretRevealResponse> => {
    const res = await api.get<SecretRevealResponse>(`/api/v1/secrets/vault/${secretId}/reveal`);
    return res.data;
  },
  deleteSecret: async (secretId: string): Promise<void> => {
    await api.delete(`/api/v1/secrets/vault/${secretId}`);
  },
  runLeakScan: async (): Promise<SecretLeakScanResult> => {
    const res = await api.post<SecretLeakScanResult>('/api/v1/secrets/vault/leak-scan');
    return res.data;
  },
  syncToK8s: async (req: SecretSyncK8sRequest): Promise<SecretSyncK8sResponse> => {
    const res = await api.post<SecretSyncK8sResponse>('/api/v1/secrets/vault/sync-k8s', req);
    return res.data;
  },
};
