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
} from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { organizationService } from '@/services/organizations';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRoleType,
} from '@/types';

export const OrganizationSettingsPage: React.FC = () => {
  const { activeOrg, isAdmin, refreshOrganizations } = useOrganization();
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

  // Role update state
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!activeOrg) return;
    try {
      setIsLoading(true);
      setError(null);
      const [membersData, invitesData] = await Promise.all([
        organizationService.listMembers(activeOrg.id),
        isAdmin
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
  }, [activeOrg, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (targetUserId: number, newRole: OrganizationRoleType) => {
    if (!activeOrg) return;
    try {
      setUpdatingUserId(targetUserId);
      setError(null);
      await organizationService.updateMemberRole(activeOrg.id, targetUserId, newRole);
      setSuccessMsg(`Role updated to ${newRole.replace('_', ' ')}`);
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
    if (!window.confirm(`Are you sure you want to remove ${email} from this workspace?`)) {
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
      await organizationService.inviteMember(activeOrg.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSuccessMsg(`Invitation dispatched to ${inviteEmail}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setInviteEmail('');
      setIsInviteModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleBadge = (role: OrganizationRoleType) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ORGANIZATION_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        );
      case 'DEVOPS_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800">
            <Terminal className="h-3 w-3" />
            DevOps
          </span>
        );
      case 'DEVELOPER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <Code2 className="h-3 w-3" />
            Developer
          </span>
        );
      case 'SECURITY_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Shield className="h-3 w-3" />
            Security
          </span>
        );
      case 'VIEWER':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            <Eye className="h-3 w-3" />
            Viewer
          </span>
        );
    }
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

        {isAdmin && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
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
          Multi-Tenant RBAC Permissions Matrix
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-xs">
            <div className="font-bold text-purple-900 mb-1">Organization Admin</div>
            <p className="text-[11px] text-purple-800">
              Full workspace control: manage members, invite users, update roles, configure cloud integrations.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 text-xs">
            <div className="font-bold text-cyan-900 mb-1">DevOps Engineer</div>
            <p className="text-[11px] text-cyan-800">
              CI/CD workflows, Docker hosts, Kubernetes clusters, Cloud Telemetry, and Cloud FinOps budgets.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs">
            <div className="font-bold text-emerald-900 mb-1">Developer</div>
            <p className="text-[11px] text-emerald-800">
              Connected repositories, commits, PR reviews, AI Code Intelligence, and failure predictions.
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs">
            <div className="font-bold text-amber-900 mb-1">Security Engineer</div>
            <p className="text-[11px] text-amber-800">
              Security hub, dependency CVEs, secret leak scanners, compliance reports, and incident response.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="font-bold text-slate-800 mb-1">Viewer</div>
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
                {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
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
                              <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="text-dark-400 text-[11px]">{memberEmail}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {isAdmin && !isOwner ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            disabled={updatingUserId === member.user_id}
                            onChange={(e) =>
                              handleRoleChange(
                                member.user_id,
                                e.target.value as OrganizationRoleType
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/20"
                          >
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

                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {!isOwner && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id, memberEmail)}
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

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-dark-100">
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-dark-400 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Invitee Email</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Expires</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-3.5 font-semibold text-dark-100">{inv.email}</td>
                    <td className="px-6 py-3.5">{getRoleBadge(inv.role)}</td>
                    <td className="px-6 py-3.5 text-dark-400">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="rounded-full bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Pending
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-dark-100">Invite Team Member</h3>
                  <p className="text-xs text-dark-400">Grant scoped workspace membership</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-200 mb-1.5">
                  Assigned RBAC Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRoleType)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-dark-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="ORGANIZATION_ADMIN">Organization Admin (Full Access)</option>
                  <option value="DEVOPS_ENGINEER">DevOps Engineer (Pipelines, Infra, Telemetry)</option>
                  <option value="DEVELOPER">Developer (Repositories, PRs, Code Intel)</option>
                  <option value="SECURITY_ENGINEER">Security Engineer (Vulnerabilities, Audits)</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSettingsPage;
