import api from '@/services/api';

export interface SecurityReportSummary {
  total_scans: number;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  remediated_findings: number;
  posture_grade: string;
  sbom_components_count: number;
}

export interface ReliabilityReportSummary {
  slos_monitored: number;
  slos_meeting_target: number;
  compliance_percentage: number;
  average_mttd_minutes: number;
  average_mttr_minutes: number;
  active_monitors_count: number;
}

export interface FinOpsReportSummary {
  total_spend_usd: number;
  forecasted_run_rate_usd: number;
  active_optimizations: number;
  potential_monthly_savings_usd: number;
  budgets_healthy: number;
  budgets_alerting: number;
}

export interface DisasterRecoveryReportSummary {
  backup_records_count: number;
  drills_executed: number;
  latest_rpo_minutes: number;
  latest_rto_minutes: number;
  dr_readiness_pct: number;
}

export interface IncidentReportSummary {
  total_incidents: number;
  active_incidents: number;
  p1_critical_active: number;
  p2_high_active: number;
  resolved_incidents: number;
}

export interface CicdReportSummary {
  total_deployments: number;
  successful_deployments: number;
  deployment_success_rate_pct: number;
  average_lead_time_hours: number;
}

export interface ExecutiveSummaryResponse {
  organization_id?: number | null;
  organization_name: string;
  generated_at: string;
  time_period: string;
  security: SecurityReportSummary;
  reliability: ReliabilityReportSummary;
  finops: FinOpsReportSummary;
  disaster_recovery: DisasterRecoveryReportSummary;
  incidents: IncidentReportSummary;
  cicd: CicdReportSummary;
  integrity_signature: string;
}

export interface ReportScheduleRequest {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  format: 'PDF' | 'CSV';
  recipients: string[];
  report_sections: string[];
}

export interface NotificationTestResponse {
  channel: string;
  target: string;
  delivery_status: 'DELIVERED' | 'FAILED' | 'CONFIG_MISSING';
  timestamp: string;
  latency_ms: number;
  details: string;
}

export const reportsService = {
  getExecutiveSummary: async (orgId?: number, timePeriod: string = '30d'): Promise<ExecutiveSummaryResponse> => {
    const params = new URLSearchParams({ time_period: timePeriod });
    if (orgId) params.append('org_id', orgId.toString());
    const res = await api.get<ExecutiveSummaryResponse>(`/reports/executive-summary?${params.toString()}`);
    return res.data;
  },

  downloadCsv: async (orgId?: number, timePeriod: string = '30d'): Promise<void> => {
    const params = new URLSearchParams({ time_period: timePeriod });
    if (orgId) params.append('org_id', orgId.toString());
    const res = await api.get(`/reports/export/csv?${params.toString()}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DevOpsPulse_Executive_Report_${timePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  openPrintablePdf: (orgId?: number, timePeriod: string = '30d'): void => {
    const token = localStorage.getItem('access_token');
    const params = new URLSearchParams({ time_period: timePeriod });
    if (orgId) params.append('org_id', orgId.toString());
    const apiUrl = `/api/v1/reports/export/pdf?${params.toString()}`;
    
    // Fetch and open in new tab with auth token
    fetch(apiUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.text())
      .then((html) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      })
      .catch((err) => {
        console.error('Failed to load printable PDF report', err);
      });
  },

  scheduleReport: async (payload: ReportScheduleRequest) => {
    const res = await api.post('/reports/schedule', payload);
    return res.data;
  },

  testNotification: async (channel: 'EMAIL' | 'WEBHOOK' | 'SLACK', target: string): Promise<NotificationTestResponse> => {
    const res = await api.post<NotificationTestResponse>('/reports/test-notification', { channel, target });
    return res.data;
  },
};
