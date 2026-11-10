import api from './api';

export interface Vulnerability {
  id: number;
  cve_id: string;
  title: string;
  package_name: string;
  current_version: string;
  fixed_in: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  detected_at: string;
}

export interface SecretFinding {
  id: number;
  file_path: string;
  secret_type: string;
  line_number: number;
  severity: string;
  status: string;
}

export interface SecurityScorecard {
  overall_score: number;
  grade: string;
  total_vulnerabilities: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  secret_scans_passed: boolean;
  dependencies_audited: number;
  last_scanned_at: string;
}

export interface SecurityOverview {
  scorecard: SecurityScorecard;
  vulnerabilities: Vulnerability[];
  secret_findings: SecretFinding[];
}

export const securityService = {
  getOverview: () => api.get<SecurityOverview>('/api/v1/security/overview'),
  triggerScan: () => api.post<{ message: string }>('/api/v1/security/scan'),
};
