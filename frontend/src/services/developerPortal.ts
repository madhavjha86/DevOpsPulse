import api from './api';

export type ServiceTier = 'TIER_1_CRITICAL' | 'TIER_2_CORE' | 'TIER_3_SUPPORTING';
export type ServiceLifecycle = 'PRODUCTION' | 'BETA' | 'EXPERIMENTAL' | 'DEPRECATED';
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface TerraformWorkspace {
  id: number;
  name: string;
  repository_url: string;
  working_directory: string;
  terraform_version: string;
  current_state_version: number;
  resource_count: number;
  status: string;
  has_drift: boolean;
  last_drift_check_at?: string | null;
  last_applied_at?: string | null;
  auto_approve_enabled: boolean;
  description?: string | null;
  created_at: string;
}

export interface TerraformRun {
  id: number;
  workspace_id: number;
  run_type: string;
  status: string;
  resources_to_add: number;
  resources_to_change: number;
  resources_to_destroy: number;
  is_destructive: boolean;
  plan_output?: string | null;
  security_scan_passed: boolean;
  security_issues_count: number;
  approved_by?: string | null;
  rollback_guidance?: string | null;
  created_at: string;
}

export interface ServiceCatalogItem {
  id: number;
  name: string;
  display_name: string;
  description: string;
  tier: ServiceTier | string;
  owner_team: string;
  tech_stack: string;
  lifecycle: ServiceLifecycle | string;
  health_status: HealthStatus | string;
  environment: string;
  repository_url?: string | null;
  documentation_url?: string | null;
  api_spec_url?: string | null;
  created_at: string;
}

export interface GoldenPathTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  repository_template_url: string;
  ci_template: string;
  is_recommended: boolean;
}

export interface DeveloperPortalOverview {
  total_services: number;
  tier_1_count: number;
  healthy_services_count: number;
  templates_count: number;
  services: ServiceCatalogItem[];
  templates: GoldenPathTemplate[];
}

export const developerPortalService = {
  getOverview: () => api.get<DeveloperPortalOverview>('/api/v1/developer-portal/overview'),
  createService: (payload: {
    name: string;
    display_name: string;
    description: string;
    tier: ServiceTier;
    owner_team: string;
    tech_stack: string;
    lifecycle?: ServiceLifecycle;
    health_status?: HealthStatus;
    environment?: string;
    repository_url?: string;
    documentation_url?: string;
    api_spec_url?: string;
  }) => api.post<ServiceCatalogItem>('/api/v1/developer-portal/services', payload),
  listWorkspaces: () => api.get<TerraformWorkspace[]>('/api/v1/developer-portal/iac/workspaces'),
  createWorkspace: (payload: {
    name: string;
    repository_url: string;
    working_directory?: string;
    terraform_version?: string;
    description?: string;
  }) => api.post<TerraformWorkspace>('/api/v1/developer-portal/iac/workspaces', payload),
  planWorkspace: (workspaceId: number) =>
    api.post<TerraformRun>(`/api/v1/developer-portal/iac/workspaces/${workspaceId}/plan`),
  applyRun: (runId: number, approvedBy: string = 'Platform DevOps Lead') =>
    api.post<TerraformRun>('/api/v1/developer-portal/iac/runs/apply', { run_id: runId, approved_by: approvedBy }),
  checkDrift: (workspaceId: number) =>
    api.post<TerraformWorkspace>(`/api/v1/developer-portal/iac/workspaces/${workspaceId}/drift`),
};
