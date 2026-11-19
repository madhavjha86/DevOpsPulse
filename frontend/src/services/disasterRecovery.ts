import api from './api';

export interface BackupRecord {
  id: number;
  backup_name: string;
  backup_type: string;
  target_database: string;
  storage_location: string;
  size_bytes: number;
  status: string;
  checksum_sha256: string;
  completed_at?: string | null;
  created_at: string;
}

export interface DrillResult {
  id: number;
  drill_name: string;
  target_system: string;
  status: string;
  rpo_target_minutes: number;
  rpo_actual_minutes: number;
  rto_target_minutes: number;
  rto_actual_minutes: number;
  data_loss_bytes: number;
  backup_snapshot_id: string;
  verification_notes: string;
  tested_by: string;
  executed_at: string;
}

export interface DisasterRecoveryOverview {
  target_rpo_minutes: number;
  actual_rpo_minutes: number;
  target_rto_minutes: number;
  actual_rto_minutes: number;
  readiness_score: number;
  readiness_grade: string;
  last_drill_at?: string | null;
  total_backups_count: number;
  latest_backup_completed: boolean;
  drills: DrillResult[];
  backups: BackupRecord[];
}

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string;
  is_active: boolean;
  expires_at?: string | null;
  last_used_at?: string | null;
  last_used_ip?: string | null;
  created_at: string;
}

export interface CreatedApiKey {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string;
  raw_key: string;
  expires_at?: string | null;
  created_at: string;
}

export const disasterRecoveryService = {
  getOverview: () => api.get<DisasterRecoveryOverview>('/api/v1/disaster-recovery/overview'),
  executeDrill: (payload: { drill_name?: string; target_system?: string } = {}) =>
    api.post<DrillResult>('/api/v1/disaster-recovery/drills', {
      drill_name: payload.drill_name || 'Quarterly Point-in-Time Recovery Certification Drill',
      target_system: payload.target_system || 'PostgreSQL Primary Cluster',
    }),
  createBackup: (payload: { backup_name: string; target_database?: string; backup_type?: string }) =>
    api.post<BackupRecord>('/api/v1/disaster-recovery/backups', {
      backup_name: payload.backup_name,
      target_database: payload.target_database || 'devopspulse-production-db',
      backup_type: payload.backup_type || 'FULL_SNAPSHOT',
    }),
  listApiKeys: () => api.get<ApiKey[]>('/api/v1/disaster-recovery/api-keys'),
  createApiKey: (payload: { name: string; scopes?: string; expires_in_days?: number }) =>
    api.post<CreatedApiKey>('/api/v1/disaster-recovery/api-keys', {
      name: payload.name,
      scopes: payload.scopes || 'read:telemetry,write:iac,read:security',
      expires_in_days: payload.expires_in_days || 90,
    }),
  revokeApiKey: (keyId: number) => api.delete<ApiKey>(`/api/v1/disaster-recovery/api-keys/${keyId}`),
};
