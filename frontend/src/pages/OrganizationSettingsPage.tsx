import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  ShieldCheck,
  Terminal,
  Code2,
  Eye,
  Copy,
  RefreshCw,
  Ban,
  Clock,
  ExternalLink,
  History,
  Download,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Bell,
  Send,
  Radio,
  Globe,
  Activity,
  Check,
} from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useAuth } from '@/context/AuthContext';
import { organizationService } from '@/services/organizations';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRoleType,
  AuditLogEntry,
  OrganizationWebhook,
  WebhookTargetType,
} from '@/types';

export const OrganizationSettingsPage: React.FC = () => {
  const { activeOrg, activeTenantInfo, isAdmin, userRole, refreshOrganizations } = useOrganization();
  const { user } = useAuth();

  // Superuser check
  const isSuperAdmin =
    Boolean(user?.is_superuser) ||
    user?.role === 'super_admin' ||
    userRole === 'SUPER_ADMIN' ||
    activeOrg?.role === 'SUPER_ADMIN';

  // Scoped admin check: only true if user is superuser or is admin of activeOrg
  const isOrgAdmin =
    isSuperAdmin ||
    activeOrg?.role === 'ORGANIZATION_ADMIN' ||
    Boolean(isAdmin && activeTenantInfo?.organization_id === activeOrg?.id);

  const canViewAuditLogs =
    isOrgAdmin ||
    isSuperAdmin ||
    userRole === 'SECURITY_ENGINEER' ||
    Boolean(activeTenantInfo?.is_security);

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRoleType>('DEVELOPER');
  const [isInviting, setIsInviting] = useState(false);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<OrganizationInvitation | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);

  // Member update / action states
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [actionInProgressInviteId, setActionInProgressInviteId] = useState<number | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPages, setAuditPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!activeOrg || !canViewAuditLogs) return;
    try {
      setIsAuditLoading(true);
      const data = await organizationService.listAuditLogs(activeOrg.id, {
        action: auditActionFilter || undefined,
        search: auditSearchQuery || undefined,
        page: auditPage,
        perPage: 15,
      });
      setAuditLogs(data.items);
      setAuditTotal(data.total);
      setAuditPages(data.pages);
    } catch {
      // Gracefully handle if audit log fetching fails
    } finally {
      setIsAuditLoading(false);
    }
  }, [activeOrg, canViewAuditLogs, auditActionFilter, auditSearchQuery, auditPage]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const handleExportAuditLogs = async () => {
    if (!activeOrg) return;
    try {
      setIsExportingCsv(true);
      const blob = await organizationService.exportAuditLogsCsv(activeOrg.id, {
        action: auditActionFilter || undefined,
        search: auditSearchQuery || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `devopspulse_audit_logs_org_${activeOrg.id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export audit logs');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Webhook Alert Channels state
  const [webhooks, setWebhooks] = useState<OrganizationWebhook[]>([]);
  const [isWebhooksLoading, setIsWebhooksLoading] = useState(false);
  const [isAddWebhookModalOpen, setIsAddWebhookModalOpen] = useState(false);
  const [webhookTestingId, setWebhookTestingId] = useState<number | null>(null);
  const [testResultFeedback, setTestResultFeedback] = useState<{
    id: number;
    message: string;
    success: boolean;
  } | null>(null);

  // New webhook form
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookTarget, setNewWebhookTarget] = useState<WebhookTargetType>('SLACK');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'incident.created',
    'incident.resolved',
    'incident.critical',
  ]);
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookFormError, setWebhookFormError] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    if (!activeOrg || !canViewAuditLogs) return;
    try {
      setIsWebhooksLoading(true);
      const data = await organizationService.listWebhooks(activeOrg.id);
      setWebhooks(data);
    } catch {
      // Gracefully handle if webhooks fail
    } finally {
      setIsWebhooksLoading(false);
    }
  }, [activeOrg, canViewAuditLogs]);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    try {
      setIsCreatingWebhook(true);
      setWebhookFormError(null);
      await organizationService.createWebhook(activeOrg.id, {
        name: newWebhookName,
        target_type: newWebhookTarget,
        url: newWebhookUrl,
        events: selectedEvents,
        secret: newWebhookSecret || undefined,
      });
      setIsAddWebhookModalOpen(false);
      setNewWebhookName('');
      setNewWebhookUrl('');
      setNewWebhookSecret('');
      setSelectedEvents(['incident.created', 'incident.resolved', 'incident.critical']);
      await loadWebhooks();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setWebhookFormError(
        typeof msg === 'string' ? msg : 'Failed to register webhook channel'
      );
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleTestWebhook = async (webhookId: number) => {
    if (!activeOrg) return;
    try {
      setWebhookTestingId(webhookId);
      const res = await organizationService.testWebhook(activeOrg.id, webhookId);
      setTestResultFeedback({
        id: webhookId,
        message: res.message,
        success: res.success,
      });
      await loadWebhooks();
      setTimeout(() => setTestResultFeedback(null), 6000);
    } catch {
      setTestResultFeedback({
        id: webhookId,
        message: 'Network error sending test ping',
        success: false,
      });
    } finally {
      setWebhookTestingId(null);
    }
  };

  const handleDeleteWebhook = async (webhookId: number, name: string) => {
    if (!activeOrg || !window.confirm(`Are you sure you want to delete alert webhook "${name}"?`))
      return;
    try {
      await organizationService.deleteWebhook(activeOrg.id, webhookId);
      await loadWebhooks();
    } catch {
      setError('Failed to delete webhook');
    }
  };

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setIsLoading(true);
      setError(null);
      const [membersData, invitesData] = await Promise.all([
        organizationService.listMembers(activeOrg.id),
        isOrgAdmin
          ? organizationService.listInvitations(activeOrg.id).catch(() => [])
          : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvitations(invitesData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load organization members';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrg, isOrgAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRoleChange = async (targetUserId: number, newRole: OrganizationRoleType) => {
    if (!activeOrg) return;
    try {
      setUpdatingUserId(targetUserId);
      setError(null);
      await organizationService.updateMemberRole(activeOrg.id, targetUserId, newRole);
      setSuccessMsg(`Role updated to ${newRole.replace(/_/g, ' ')}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update member role';
      setError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: number, email: string) => {
    if (!activeOrg) return;
    if (!window.confirm(`Are you sure you want to remove ${email} from ${activeOrg.name}?`)) {
      return;
    }

    try {
      setError(null);
      await organizationService.removeMember(activeOrg.id, targetUserId);
      setSuccessMsg(`Member ${email} removed.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
      await refreshOrganizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      setError(msg);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      setError(null);
      const invite = await organizationService.inviteMember(activeOrg.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setLastCreatedInvite(invite);
      if (invite.email_status === 'EMAIL_NOT_CONFIGURED') {
        setSuccessMsg('Invitation created (EMAIL_NOT_CONFIGURED: copy direct link below).');
      } else {
        setSuccessMsg(`Invitation dispatched to ${inviteEmail}`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }

      setInviteEmail('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleResendInvite = async (invitationId: number) => {
    if (!activeOrg) return;
    try {
      setActionInProgressInviteId(invitationId);
      setError(null);
      const updated = await organizationService.resendInvitation(activeOrg.id, invitationId);
      setLastCreatedInvite(updated);
      setIsInviteModalOpen(true);
      setSuccessMsg(`Invitation token renewed for 48h for ${updated.email}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend invitation';
      setError(msg);
    } finally {
      setActionInProgressInviteId(null);
    }
  };

  const handleRevokeInvite = async (invitationId: number) => {
    if (!activeOrg) return;
    if (!window.confirm('Are you sure you want to revoke this pending invitation?')) return;

    try {
      setActionInProgressInviteId(invitationId);
      setError(null);
      await organizationService.revokeInvitation(activeOrg.id, invitationId);
      setSuccessMsg('Invitation revoked successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke invitation';
      setError(msg);
    } finally {
      setActionInProgressInviteId(null);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const getRoleBadge = (role: OrganizationRoleType) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
            <ShieldCheck className="h-3 w-3 text-purple-700" />
            Super Admin
          </span>
        );
      case 'ORGANIZATION_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
            <Shield className="h-3 w-3 text-indigo-700" />
            Org Admin
          </span>
        );
      case 'DEVOPS_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200">
            <Terminal className="h-3 w-3 text-cyan-700" />
            DevOps
          </span>
        );
      case 'DEVELOPER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
            <Code2 className="h-3 w-3 text-emerald-700" />
            Developer
          </span>
        );
      case 'SECURITY_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
            <Shield className="h-3 w-3 text-rose-700" />
            Security
          </span>
        );
      case 'VIEWER':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
            <Eye className="h-3 w-3 text-slate-600" />
            Viewer
          </span>
        );
    }
  };

  const getStatusBadge = (status?: string, isAccepted?: boolean, expiresAt?: string) => {
    let resolvedStatus = status;
    if (!resolvedStatus) {
      if (isAccepted) resolvedStatus = 'ACCEPTED';
      else if (expiresAt && new Date(expiresAt) < new Date()) resolvedStatus = 'EXPIRED';
      else resolvedStatus = 'PENDING';
    }

    switch (resolvedStatus) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
            <Ban className="h-3 w-3" />
            Revoked
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
            <Clock className="h-3 w-3" />
            Expired
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  const getActionBadge = (action: string) => {
    if (action.startsWith('member.invited')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
          Member Invited
        </span>
      );
    }
    if (action.startsWith('member.role_updated')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
          Role Updated
        </span>
      );
    }
    if (action.startsWith('member.removed')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          Member Removed
        </span>
      );
    }
    if (action.startsWith('invitation.accepted')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          Invitation Accepted
        </span>
      );
    }
    if (action.startsWith('invitation.revoked')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
          Invitation Revoked
        </span>
      );
    }
    if (action.startsWith('incident.created')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          Incident Created
        </span>
      );
    }
    if (action.startsWith('incident.resolved')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          Incident Resolved
        </span>
      );
    }
    if (action.startsWith('incident.post_mortem_generated')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-700 border border-cyan-200">
          AI Post-Mortem
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-fade-in">
      {/* Workspace Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 shrink-0">
            {activeOrg?.type === 'COMPANY' ? (
              <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              <User className="h-6 w-6 sm:h-7 sm:w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold text-dark-100 break-words">
                {activeOrg?.name || 'Workspace Settings'}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-dark-400 capitalize shrink-0">
                {activeOrg?.type.toLowerCase() || 'workspace'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-dark-400 mt-1">
              Slug: <code className="text-purple-600">{activeOrg?.slug}</code> • Tenant ID: {activeOrg?.id} • Isolated database partitions
            </p>
          </div>
        </div>

        {isOrgAdmin && (
          <button
            onClick={() => {
              setLastCreatedInvite(null);
              setIsInviteModalOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-md shadow-purple-500/20 transition-all min-h-[44px] shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Status Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role Hierarchy Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-dark-400 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-600" />
          Multi-Tenant RBAC Permissions Matrix (6 Roles)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-xs">
            <div className="font-bold text-purple-900 mb-1 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-700" />
              Super Admin
            </div>
            <p className="text-[11px] text-purple-800">
              Platform-wide root authority. Cross-organization access, global billing, and system migrations.
            </p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs">
            <div className="font-bold text-indigo-900 mb-1 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-indigo-700" />
              Org Admin
            </div>
            <p className="text-[11px] text-indigo-800">
              Full workspace control: manage members, invite users, update roles, configure cloud integrations.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 text-xs">
            <div className="font-bold text-cyan-900 mb-1 flex items-center gap-1">
              <Terminal className="h-3.5 w-3.5 text-cyan-700" />
              DevOps
            </div>
            <p className="text-[11px] text-cyan-800">
              CI/CD workflows, Docker hosts, Kubernetes clusters, Cloud Telemetry, and FinOps budgets.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
            <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
              <Code2 className="h-3.5 w-3.5 text-emerald-700" />
              Developer
            </div>
            <p className="text-[11px] text-emerald-800">
              Connected repositories, commits, PR reviews, AI Code Intelligence, and failure predictions.
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs">
            <div className="font-bold text-rose-900 mb-1 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-rose-700" />
              Security
            </div>
            <p className="text-[11px] text-rose-800">
              Security hub, dependency CVEs, secret leak scanners, compliance reports, and incident response.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="font-bold text-slate-800 mb-1 flex items-center gap-1">
              <Eye className="h-3.5 w-3.5 text-slate-600" />
              Viewer
            </div>
            <p className="text-[11px] text-slate-600">
              Read-only visibility into dashboard metrics, DORA delivery velocity, and operational uptime.
            </p>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-bold text-dark-100">
              Workspace Members ({members.length})
            </h2>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-purple-600" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-dark-400 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Joined Date</th>
                {isOrgAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const isOwner = member.user_id === activeOrg?.owner_id;
                const memberEmail = member.email || member.user_email || '';
                const memberName = member.full_name || member.user_full_name || member.username || 'Team Member';
                const memberInitials = (member.full_name || member.user_full_name || member.username || memberEmail || 'U')
                  .trim()
                  .substring(0, 2)
                  .toUpperCase();
                const joinedDate = member.joined_at || member.created_at;

                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700 text-xs">
                          {memberInitials}
                        </div>
                        <div>
                          <div className="font-bold text-dark-100">
                            {memberName}
                            {isOwner && (
                              <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="text-dark-400 text-[11px]">{memberEmail}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {isOrgAdmin && !isOwner ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            disabled={updatingUserId === member.user_id}
                            onChange={(e) => {
                              void handleRoleChange(
                                member.user_id,
                                e.target.value as OrganizationRoleType
                              );
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
                          >
                            {isSuperAdmin && (
                              <option value="SUPER_ADMIN">Super Admin</option>
                            )}
                            <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                            <option value="DEVOPS_ENGINEER">DevOps Engineer</option>
                            <option value="DEVELOPER">Developer</option>
                            <option value="SECURITY_ENGINEER">Security Engineer</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          {updatingUserId === member.user_id && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                          )}
                        </div>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </td>

                    <td className="px-6 py-4 text-dark-400">
                      {joinedDate ? new Date(joinedDate).toLocaleDateString() : 'Active'}
                    </td>

                    {isOrgAdmin && (
                      <td className="px-6 py-4 text-right">
                        {!isOwner && (
                          <button
                            onClick={() => {
                              void handleRemoveMember(member.user_id, memberEmail);
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitations Section */}
      {isOrgAdmin && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-dark-100">
                Workspace Invitations ({invitations.length})
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">
              Single-use tokens • SHA-256 hashed in database • 48h expiration
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No invitations recorded for this workspace. Click &quot;Invite Member&quot; above to add colleagues.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-dark-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Invitee Email</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Expires</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => {
                    const isPending = (inv.status || (inv.is_accepted ? 'ACCEPTED' : 'PENDING')) === 'PENDING';
                    const isActionLoading = actionInProgressInviteId === inv.id;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-dark-100">
                          <div>{inv.email}</div>
                          {inv.email_status === 'EMAIL_NOT_CONFIGURED' && (
                            <span className="text-[10px] text-amber-600 font-medium">
                              SMTP unconfigured (Manual link required)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">{getRoleBadge(inv.role)}</td>
                        <td className="px-6 py-3.5">
                          {getStatusBadge(inv.status, inv.is_accepted, inv.expires_at)}
                        </td>
                        <td className="px-6 py-3.5 text-dark-400">
                          {new Date(inv.expires_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => {
                                    void handleResendInvite(inv.id);
                                  }}
                                  disabled={isActionLoading}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                  title="Resend invitation & reset 48-hour expiration"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                  Resend
                                </button>
                                <button
                                  onClick={() => {
                                    void handleRevokeInvite(inv.id);
                                  }}
                                  disabled={isActionLoading}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                  title="Revoke invitation"
                                >
                                  <Ban className="h-3 w-3" />
                                  Revoke
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Alert Channels & Outbound Webhooks */}
      {canViewAuditLogs && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
                  <span>Alert Channels & Outbound Webhooks</span>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                    {webhooks.length} Configured
                  </span>
                </h2>
                <p className="text-[11px] text-dark-400">
                  Deliver instant alerts to Slack, Discord, Microsoft Teams, or custom HTTP endpoints on critical incidents
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setWebhookFormError(null);
                setNewWebhookName('');
                setNewWebhookUrl('');
                setNewWebhookSecret('');
                setIsAddWebhookModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              Add Alert Channel
            </button>
          </div>

          {/* Test Result Toast/Banner */}
          {testResultFeedback && (
            <div
              className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                testResultFeedback.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResultFeedback.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{testResultFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTestResultFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {isWebhooksLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              Loading configured channels...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-xs font-bold text-dark-100">No alert webhooks configured</h3>
              <p className="text-[11px] text-dark-400 max-w-sm mx-auto mt-1 mb-4">
                Connect your engineering team's Slack, Discord, or Microsoft Teams channels to receive instant notifications when critical incidents occur.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewWebhookTarget('SLACK');
                    setNewWebhookName('#devops-alerts');
                    setNewWebhookUrl('');
                    setIsAddWebhookModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span className="font-bold text-[#4A154B]">#</span> Slack Channel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewWebhookTarget('DISCORD');
                    setNewWebhookName('Discord Alerts');
                    setNewWebhookUrl('');
                    setIsAddWebhookModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Radio className="h-3.5 w-3.5 text-[#5865F2]" /> Discord Server
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewWebhookTarget('TEAMS');
                    setNewWebhookName('MS Teams SRE');
                    setNewWebhookUrl('');
                    setIsAddWebhookModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-3.5 w-3.5 text-[#6264A7]" /> MS Teams
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewWebhookTarget('GENERIC');
                    setNewWebhookName('Custom HTTPS Webhook');
                    setNewWebhookUrl('');
                    setIsAddWebhookModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Globe className="h-3.5 w-3.5 text-purple-600" /> Custom Webhook
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-dark-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Target & Channel</th>
                    <th className="px-6 py-3.5">Endpoint URL</th>
                    <th className="px-6 py-3.5">Events</th>
                    <th className="px-6 py-3.5">Last Delivery</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {webhooks.map((wh) => (
                    <tr key={wh.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-dark-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${
                              wh.target_type === 'SLACK'
                                ? 'bg-[#4A154B]/10 text-[#4A154B]'
                                : wh.target_type === 'DISCORD'
                                ? 'bg-[#5865F2]/10 text-[#5865F2]'
                                : wh.target_type === 'TEAMS'
                                ? 'bg-[#6264A7]/10 text-[#6264A7]'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {wh.target_type === 'SLACK'
                              ? '#'
                              : wh.target_type === 'DISCORD'
                              ? 'D'
                              : wh.target_type === 'TEAMS'
                              ? 'T'
                              : 'W'}
                          </span>
                          <div>
                            <div className="font-bold text-dark-100">{wh.name}</div>
                            <div className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">
                              {wh.target_type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-dark-300">
                        <span title={wh.url}>
                          {wh.url.length > 40 ? `${wh.url.slice(0, 32)}...${wh.url.slice(-8)}` : wh.url}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <span
                              key={ev}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {wh.last_delivery_status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              <Check className="h-3 w-3" />
                              {wh.last_status_code ? `HTTP ${wh.last_status_code}` : 'Delivered'}
                            </span>
                          ) : wh.last_delivery_status === 'FAILED' ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"
                              title={wh.last_error || 'Delivery failed'}
                            >
                              <AlertCircle className="h-3 w-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              Untested
                            </span>
                          )}
                          {wh.last_dispatched_at && (
                            <span className="text-[10px] text-dark-400">
                              {new Date(wh.last_dispatched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              void handleTestWebhook(wh.id);
                            }}
                            disabled={webhookTestingId === wh.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
                            title="Send immediate test ping"
                          >
                            {webhookTestingId === wh.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Activity className="h-3 w-3" />
                            )}
                            Test Ping
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteWebhook(wh.id, wh.name);
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Webhook"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Security & Compliance Audit Trail */}
      {canViewAuditLogs && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              <div>
                <h2 className="text-sm font-bold text-dark-100">
                  Security & Compliance Audit Trail ({auditTotal})
                </h2>
                <p className="text-[11px] text-dark-400">
                  Immutable record of administrative, role, invitation, and incident actions (SOC2 / ISO 27001 readiness)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="audit-search-input"
                  aria-label="Search audit logs"
                  type="text"
                  placeholder="Search logs..."
                  value={auditSearchQuery}
                  onChange={(e) => {
                    setAuditSearchQuery(e.target.value);
                    setAuditPage(1);
                  }}
                  className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/20 w-44"
                />
              </div>

              {/* Action Filter */}
              <select
                id="audit-action-filter"
                aria-label="Filter audit logs by action"
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
              >
                <option value="">All Actions</option>
                <option value="member.invited">Member Invited</option>
                <option value="member.role_updated">Role Updated</option>
                <option value="member.removed">Member Removed</option>
                <option value="invitation.accepted">Invitation Accepted</option>
                <option value="invitation.revoked">Invitation Revoked</option>
                <option value="incident.created">Incident Created</option>
                <option value="incident.resolved">Incident Resolved</option>
                <option value="incident.post_mortem_generated">Post-Mortem Generated</option>
              </select>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={() => {
                  void handleExportAuditLogs();
                }}
                disabled={isExportingCsv || auditTotal === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
                title="Download complete audit log as CSV"
              >
                {isExportingCsv ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export CSV
              </button>
            </div>
          </div>

          {isAuditLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit log entries matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-dark-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Timestamp (UTC)</th>
                    <th className="px-6 py-3.5">Action</th>
                    <th className="px-6 py-3.5">Actor</th>
                    <th className="px-6 py-3.5">Resource</th>
                    <th className="px-6 py-3.5">IP Address</th>
                    <th className="px-6 py-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 text-dark-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">{getActionBadge(log.action)}</td>
                      <td className="px-6 py-3.5 font-medium text-dark-100">
                        <div>{log.user_name || log.user_email || 'System'}</div>
                        {log.user_email && log.user_name && (
                          <div className="text-[10px] text-dark-400">{log.user_email}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-dark-300 font-mono text-[11px]">
                        {log.resource_type ? `${log.resource_type}:${log.resource_id ?? ''}` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-dark-400 font-mono text-[11px]">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditLog(log)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <FileText className="h-3 w-3 text-slate-500" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {auditPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-dark-400">
                  <span>
                    Showing page {auditPage} of {auditPages} ({auditTotal} total events)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= auditPages}
                      onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Audit Log Details Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-dark-100">
                  Audit Event #{selectedAuditLog.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Action</span>
                  <span className="font-semibold text-dark-100">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Timestamp</span>
                  <span className="text-dark-300">{new Date(selectedAuditLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Actor</span>
                  <span className="text-dark-200">{selectedAuditLog.user_email || 'System'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">IP / Origin</span>
                  <span className="font-mono text-dark-300">{selectedAuditLog.ip_address || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-dark-200 block mb-1">Event Payload Details:</span>
                <pre className="rounded-xl bg-slate-900 p-3.5 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60 border border-slate-800">
                  {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
                </pre>
              </div>

              {selectedAuditLog.user_agent && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">User Agent</span>
                  <span className="text-[11px] font-mono text-slate-600 break-all">{selectedAuditLog.user_agent}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-dark-100">Invite Team Member</h3>
                  <p className="text-xs text-dark-400">
                    Grant tenant-isolated access to {activeOrg?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setLastCreatedInvite(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* If an invite was just created and email is not configured, show details banner */}
            {lastCreatedInvite && (
              <div className="mt-4 space-y-3">
                {lastCreatedInvite.email_status === 'EMAIL_NOT_CONFIGURED' ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>EMAIL_NOT_CONFIGURED</span>
                    </div>
                    <p className="text-xs text-amber-900/80 mb-3">
                      SMTP credentials are not configured in your environment. The secure invitation was registered in PostgreSQL with 48h expiry. Copy and share the single-use invite URL below directly with the user:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={
                          lastCreatedInvite.invite_url ||
                          `${window.location.origin}/invitations/accept?token=${lastCreatedInvite.raw_token || lastCreatedInvite.token}`
                        }
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono text-dark-100 select-all"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            lastCreatedInvite.invite_url ||
                              `${window.location.origin}/invitations/accept?token=${lastCreatedInvite.raw_token || lastCreatedInvite.token}`,
                            lastCreatedInvite.id
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-bold shrink-0 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedTokenId === lastCreatedInvite.id ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Invitation Dispatched Successfully</span>
                    </div>
                    <p className="text-xs text-emerald-900/80">
                      An invitation email was sent to <span className="font-semibold">{lastCreatedInvite.email}</span>.
                      They can click the link in their email to create a password and onboard.
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLastCreatedInvite(null);
                      setIsInviteModalOpen(false);
                    }}
                    className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {!lastCreatedInvite && (
              <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="invite-email-input" className="block text-xs font-semibold text-dark-200 mb-1.5">
                    User Email Address
                  </label>
                  <input
                    id="invite-email-input"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="invite-role-select" className="block text-xs font-semibold text-dark-200 mb-1.5">
                    Assigned Workspace Role
                  </label>
                  <select
                    id="invite-role-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrganizationRoleType)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    {isSuperAdmin && (
                      <option value="SUPER_ADMIN">Super Admin (Platform Root)</option>
                    )}
                    <option value="ORGANIZATION_ADMIN">Organization Admin (Full Access)</option>
                    <option value="DEVOPS_ENGINEER">DevOps Engineer (Pipelines, Infra, Telemetry)</option>
                    <option value="DEVELOPER">Developer (Repositories, PRs, Code Intel)</option>
                    <option value="SECURITY_ENGINEER">Security Engineer (Vulnerabilities, Audits)</option>
                    <option value="VIEWER">Viewer (Read-only)</option>
                  </select>
                  {!isSuperAdmin && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Note: Only Super Admins can assign the SUPER_ADMIN role.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-dark-300 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md shadow-purple-500/25"
                  >
                    {isInviting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Send Invitation
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Alert Channel Modal */}
      {isAddWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-dark-100">Add Alert Channel</h3>
                  <p className="text-[11px] text-dark-400">
                    Connect real-time notifications to your team chat or incident response
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddWebhookModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {webhookFormError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{webhookFormError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                void handleCreateWebhook(e);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <span className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Platform Preset
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewWebhookTarget('SLACK');
                      if (!newWebhookName || newWebhookName.includes('Discord') || newWebhookName.includes('Teams')) {
                        setNewWebhookName('#devops-alerts');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                      newWebhookTarget === 'SLACK'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-sm font-extrabold text-[#4A154B]">#</span>
                    <span className="text-[11px] mt-0.5">Slack</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewWebhookTarget('DISCORD');
                      if (!newWebhookName || newWebhookName.includes('#') || newWebhookName.includes('Teams')) {
                        setNewWebhookName('Discord Alerts');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                      newWebhookTarget === 'DISCORD'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Radio className="h-4 w-4 text-[#5865F2]" />
                    <span className="text-[11px] mt-0.5">Discord</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewWebhookTarget('TEAMS');
                      if (!newWebhookName || newWebhookName.includes('#') || newWebhookName.includes('Discord')) {
                        setNewWebhookName('MS Teams SRE');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                      newWebhookTarget === 'TEAMS'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Users className="h-4 w-4 text-[#6264A7]" />
                    <span className="text-[11px] mt-0.5">Teams</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewWebhookTarget('GENERIC');
                      if (!newWebhookName || newWebhookName.includes('#')) {
                        setNewWebhookName('Custom Webhook');
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all ${
                      newWebhookTarget === 'GENERIC'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Globe className="h-4 w-4 text-purple-600" />
                    <span className="text-[11px] mt-0.5">Custom</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="webhook-name-input" className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Channel Name *
                </label>
                <input
                  id="webhook-name-input"
                  type="text"
                  required
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="e.g. #incident-war-room"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label htmlFor="webhook-url-input" className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Webhook Endpoint URL *
                </label>
                <input
                  id="webhook-url-input"
                  type="url"
                  required
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder={
                    newWebhookTarget === 'SLACK'
                      ? 'https://hooks.slack.com/services/T.../B.../...'
                      : newWebhookTarget === 'DISCORD'
                      ? 'https://discord.com/api/webhooks/...'
                      : newWebhookTarget === 'TEAMS'
                      ? 'https://outlook.office.com/webhook/...'
                      : 'https://api.yourdomain.com/webhooks/alerts'
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Subscribed Alert Events
                </span>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <label htmlFor="event-incident-created" className="flex items-center gap-2 cursor-pointer text-xs font-medium text-dark-200">
                    <input
                      id="event-incident-created"
                      type="checkbox"
                      checked={selectedEvents.includes('incident.created')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, 'incident.created']);
                        } else {
                          setSelectedEvents(selectedEvents.filter((ev) => ev !== 'incident.created'));
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Incident Created (Triggers on new incident reports)</span>
                  </label>
                  <label htmlFor="event-incident-critical" className="flex items-center gap-2 cursor-pointer text-xs font-medium text-dark-200">
                    <input
                      id="event-incident-critical"
                      type="checkbox"
                      checked={selectedEvents.includes('incident.critical')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, 'incident.critical']);
                        } else {
                          setSelectedEvents(selectedEvents.filter((ev) => ev !== 'incident.critical'));
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Critical Outage (High-priority alert for P1 / CRITICAL events)</span>
                  </label>
                  <label htmlFor="event-incident-resolved" className="flex items-center gap-2 cursor-pointer text-xs font-medium text-dark-200">
                    <input
                      id="event-incident-resolved"
                      type="checkbox"
                      checked={selectedEvents.includes('incident.resolved')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, 'incident.resolved']);
                        } else {
                          setSelectedEvents(selectedEvents.filter((ev) => ev !== 'incident.resolved'));
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Incident Resolved (Notifies team when mitigation completes)</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="webhook-secret-input" className="block text-xs font-semibold text-dark-200 mb-1.5">
                  HMAC Secret Token (Optional)
                </label>
                <input
                  id="webhook-secret-input"
                  type="password"
                  value={newWebhookSecret}
                  onChange={(e) => setNewWebhookSecret(e.target.value)}
                  placeholder="Optional shared secret for SHA-256 signatures"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  If set, requests will include an <code>X-DevOpsPulse-Signature</code> header.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddWebhookModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-dark-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWebhook || !newWebhookName.trim() || !newWebhookUrl.trim()}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md shadow-purple-500/25"
                >
                  {isCreatingWebhook && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Register Alert Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSettingsPage;
