import api from './api';

export type ScanType = 'ALL' | 'SAST' | 'SCA' | 'SECRETS' | 'CONTAINER' | 'IAC';
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type FindingStatus = 'OPEN' | 'FIXED' | 'FALSE_POSITIVE' | 'SUPPRESSED';
export type SbomFormat = 'CYCLONEDX_1_5' | 'SPDX_2_3';

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
  info_count?: number;
  secret_scans_passed: boolean;
  dependencies_audited: number;
  last_scanned_at: string;
}

export interface SecurityFinding {
  id: number;
  scan_id: number;
  finding_type: 'SAST' | 'SCA' | 'SECRET' | 'CONTAINER' | 'IAC';
  cve_id?: string | null;
  title: string;
  severity: SeverityLevel;
  package_name?: string | null;
  current_version?: string | null;
  fixed_in?: string | null;
  file_path: string;
  line_number?: number | null;
  description: string;
  remediation: string;
  status: FindingStatus;
  created_at: string;
}

export interface SecurityScan {
  id: number;
  target_name: string;
  scan_type: string;
  status: string;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  score: number;
  duration_ms: number;
  completed_at?: string | null;
  created_at: string;
  findings?: SecurityFinding[];
}

export interface SbomPackage {
  id: number;
  name: string;
  version: string;
  purl: string;
  license_spdx: string;
  is_copyleft: boolean;
  cve_count: number;
  highest_severity?: string | null;
  checksum_sha256?: string | null;
}

export interface SbomDocument {
  id: number;
  format: string;
  component_name: string;
  version: string;
  total_packages: number;
  vulnerable_packages: number;
  created_at: string;
  packages: SbomPackage[];
}

export interface SecurityOverview {
  scorecard: SecurityScorecard;
  vulnerabilities: Vulnerability[];
  secret_findings: SecretFinding[];
  recent_scans?: SecurityScan[];
  active_findings?: SecurityFinding[];
  latest_sbom?: SbomDocument | null;
}

export const securityService = {
  getOverview: () => api.get<SecurityOverview>('/api/v1/security/overview'),
  triggerScanLegacy: () => api.post<{ message: string }>('/api/v1/security/scan'),
  triggerScan: (payload: { target_name?: string; scan_type?: ScanType; repository_id?: number | null } = {}) =>
    api.post<SecurityScan>('/api/v1/security/scans', {
      target_name: payload.target_name || 'devopspulse-workspace',
      scan_type: payload.scan_type || 'ALL',
      repository_id: payload.repository_id || null,
    }),
  listScans: (limit: number = 20) => api.get<SecurityScan[]>(`/api/v1/security/scans?limit=${limit}`),
  getScan: (scanId: number) => api.get<SecurityScan>(`/api/v1/security/scans/${scanId}`),
  listFindings: (params?: { severity?: string; finding_type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.severity) q.append('severity', params.severity);
    if (params?.finding_type) q.append('finding_type', params.finding_type);
    if (params?.status) q.append('status', params.status);
    const qs = q.toString();
    return api.get<SecurityFinding[]>(`/api/v1/security/findings${qs ? `?${qs}` : ''}`);
  },
  remediateFinding: (findingId: number, status: FindingStatus) =>
    api.patch<SecurityFinding>(`/api/v1/security/findings/${findingId}/remediate`, { status }),
  generateSbom: (payload: { component_name?: string; version?: string; format?: SbomFormat; repository_id?: number | null } = {}) =>
    api.post<SbomDocument>('/api/v1/security/sbom/generate', {
      component_name: payload.component_name || 'devopspulse',
      version: payload.version || '1.1.0',
      format: payload.format || 'CYCLONEDX_1_5',
      repository_id: payload.repository_id || null,
    }),
  listSboms: () => api.get<SbomDocument[]>('/api/v1/security/sbom'),
  getSbom: (sbomId: number) => api.get<SbomDocument>(`/api/v1/security/sbom/${sbomId}`),
  exportSbom: (sbomId: number) => api.get<Record<string, unknown>>(`/api/v1/security/sbom/${sbomId}/export`),
};
