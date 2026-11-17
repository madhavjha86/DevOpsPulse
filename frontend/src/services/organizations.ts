import api from './api';
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationInviteVerifyResponse,
  OrganizationInviteAcceptPayload,
  OrganizationInviteAcceptResponse,
  CreateOrganizationPayload,
  InviteMemberPayload,
  OrganizationRoleType,
  PaginatedAuditLogs,
  CreateWebhookPayload,
  OrganizationWebhook,
  WebhookTestResult,
} from '@/types';

export interface ActiveTenantContextInfo {
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  organization_type: string;
  user_role: OrganizationRoleType;
  is_admin: boolean;
  is_devops: boolean;
  is_security: boolean;
}

export const organizationService = {
  async listUserOrganizations(): Promise<Organization[]> {
    const res = await api.get<Organization[]>('/api/v1/organizations');
    return res.data;
  },

  async createOrganization(payload: CreateOrganizationPayload): Promise<Organization> {
    const res = await api.post<Organization>('/api/v1/organizations', payload);
    return res.data;
  },

  async getActiveTenantContext(): Promise<ActiveTenantContextInfo> {
    const res = await api.get<ActiveTenantContextInfo>('/api/v1/organizations/active');
    return res.data;
  },

  async getOrganization(id: number): Promise<Organization> {
    const res = await api.get<Organization>(`/api/v1/organizations/${id}`);
    return res.data;
  },

  async listMembers(orgId: number): Promise<OrganizationMember[]> {
    const res = await api.get<OrganizationMember[]>(`/api/v1/organizations/${orgId}/members`);
    return res.data;
  },

  async updateMemberRole(
    orgId: number,
    targetUserId: number,
    role: OrganizationRoleType
  ): Promise<OrganizationMember> {
    const res = await api.put<OrganizationMember>(
      `/api/v1/organizations/${orgId}/members/${targetUserId}/role`,
      { role }
    );
    return res.data;
  },

  async removeMember(orgId: number, targetUserId: number): Promise<void> {
    await api.delete(`/api/v1/organizations/${orgId}/members/${targetUserId}`);
  },

  async inviteMember(
    orgId: number,
    payload: InviteMemberPayload
  ): Promise<OrganizationInvitation> {
    const res = await api.post<OrganizationInvitation>(
      `/api/v1/organizations/${orgId}/invitations`,
      payload
    );
    return res.data;
  },

  async listInvitations(orgId: number): Promise<OrganizationInvitation[]> {
    const res = await api.get<OrganizationInvitation[]>(`/api/v1/organizations/${orgId}/invitations`);
    return res.data;
  },

  async resendInvitation(orgId: number, invitationId: number): Promise<OrganizationInvitation> {
    const res = await api.post<OrganizationInvitation>(
      `/api/v1/organizations/${orgId}/invitations/${invitationId}/resend`
    );
    return res.data;
  },

  async revokeInvitation(orgId: number, invitationId: number): Promise<void> {
    await api.post(`/api/v1/organizations/${orgId}/invitations/${invitationId}/revoke`);
  },

  async verifyInvitation(token: string): Promise<OrganizationInviteVerifyResponse> {
    const res = await api.get<OrganizationInviteVerifyResponse>(
      `/api/v1/organizations/invitations/verify?token=${encodeURIComponent(token)}`
    );
    return res.data;
  },

  async acceptInvitationOnboarding(
    payload: OrganizationInviteAcceptPayload
  ): Promise<OrganizationInviteAcceptResponse> {
    const res = await api.post<OrganizationInviteAcceptResponse>(
      '/api/v1/organizations/invitations/accept',
      payload
    );
    return res.data;
  },

  async acceptInvitation(token: string): Promise<Organization> {
    const res = await api.post<Organization>(`/api/v1/organizations/invitations/${token}/accept`);
    return res.data;
  },

  async listAuditLogs(
    orgId: number,
    params?: {
      action?: string;
      userId?: number;
      search?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<PaginatedAuditLogs> {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.userId) query.set('user_id', String(params.userId));
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.perPage) query.set('per_page', String(params.perPage));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await api.get<PaginatedAuditLogs>(`/api/v1/organizations/${orgId}/audit-logs${qs}`);
    return res.data;
  },

  async exportAuditLogsCsv(
    orgId: number,
    params?: { action?: string; userId?: number; search?: string }
  ): Promise<Blob> {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.userId) query.set('user_id', String(params.userId));
    if (params?.search) query.set('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await api.get(`/api/v1/organizations/${orgId}/audit-logs/export${qs}`, {
      responseType: 'blob',
    });
    return res.data as Blob;
  },

  async listWebhooks(orgId: number): Promise<OrganizationWebhook[]> {
    const res = await api.get<OrganizationWebhook[]>(`/api/v1/organizations/${orgId}/webhooks`);
    return res.data;
  },

  async createWebhook(
    orgId: number,
    payload: CreateWebhookPayload
  ): Promise<OrganizationWebhook> {
    const res = await api.post<OrganizationWebhook>(
      `/api/v1/organizations/${orgId}/webhooks`,
      payload
    );
    return res.data;
  },

  async deleteWebhook(orgId: number, webhookId: number): Promise<void> {
    await api.delete(`/api/v1/organizations/${orgId}/webhooks/${webhookId}`);
  },

  async testWebhook(orgId: number, webhookId: number): Promise<WebhookTestResult> {
    const res = await api.post<WebhookTestResult>(
      `/api/v1/organizations/${orgId}/webhooks/${webhookId}/test`
    );
    return res.data;
  },
};
