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
};
