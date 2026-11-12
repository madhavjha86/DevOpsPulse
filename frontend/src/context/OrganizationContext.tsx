import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Organization, CreateOrganizationPayload, OrganizationRoleType } from '@/types';
import { organizationService, type ActiveTenantContextInfo } from '@/services/organizations';
import { useAuth } from './AuthContext';

interface OrganizationContextType {
  organizations: Organization[];
  activeOrg: Organization | null;
  activeTenantInfo: ActiveTenantContextInfo | null;
  isLoading: boolean;
  switchOrganization: (orgId: number) => Promise<void>;
  createOrganization: (payload: CreateOrganizationPayload) => Promise<Organization>;
  refreshOrganizations: () => Promise<void>;
  isAdmin: boolean;
  isDevOps: boolean;
  isSecurity: boolean;
  userRole: OrganizationRoleType | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [activeTenantInfo, setActiveTenantInfo] = useState<ActiveTenantContextInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setActiveOrg(null);
      setActiveTenantInfo(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const orgs = await organizationService.listUserOrganizations();
      setOrganizations(orgs);

      const storedOrgId = localStorage.getItem('active_organization_id');
      let targetOrg = orgs.find((o) => storedOrgId && o.id === Number(storedOrgId));

      if (!targetOrg && orgs.length > 0) {
        // Prefer personal workspace by default or first org
        targetOrg = orgs.find((o) => o.type === 'PERSONAL') || orgs[0];
      }

      if (targetOrg) {
        localStorage.setItem('active_organization_id', String(targetOrg.id));
        setActiveOrg(targetOrg);
      }

      // Fetch active tenant context
      try {
        const tenantInfo = await organizationService.getActiveTenantContext();
        setActiveTenantInfo(tenantInfo);
      } catch {
        // Fallback info from targetOrg if endpoint is in transition
        if (targetOrg) {
          setActiveTenantInfo({
            organization_id: targetOrg.id,
            organization_name: targetOrg.name,
            organization_slug: targetOrg.slug,
            organization_type: targetOrg.type,
            user_role: targetOrg.role || 'VIEWER',
            is_admin: targetOrg.role === 'ORGANIZATION_ADMIN' || targetOrg.role === 'SUPER_ADMIN',
            is_devops: targetOrg.role === 'DEVOPS_ENGINEER' || targetOrg.role === 'ORGANIZATION_ADMIN',
            is_security: targetOrg.role === 'SECURITY_ENGINEER' || targetOrg.role === 'ORGANIZATION_ADMIN',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load organizations', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations]);

  const switchOrganization = async (orgId: number) => {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return;

    localStorage.setItem('active_organization_id', String(orgId));
    setActiveOrg(org);

    try {
      const tenantInfo = await organizationService.getActiveTenantContext();
      setActiveTenantInfo(tenantInfo);
    } catch {
      setActiveTenantInfo({
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        organization_type: org.type,
        user_role: org.role || 'VIEWER',
        is_admin: org.role === 'ORGANIZATION_ADMIN' || org.role === 'SUPER_ADMIN',
        is_devops: org.role === 'DEVOPS_ENGINEER' || org.role === 'ORGANIZATION_ADMIN',
        is_security: org.role === 'SECURITY_ENGINEER' || org.role === 'ORGANIZATION_ADMIN',
      });
    }

    // Trigger full window reload or query refresh so all dashboard views re-query for new tenant
    window.location.reload();
  };

  const createOrganization = async (payload: CreateOrganizationPayload): Promise<Organization> => {
    const newOrg = await organizationService.createOrganization(payload);
    await refreshOrganizations();
    localStorage.setItem('active_organization_id', String(newOrg.id));
    setActiveOrg(newOrg);
    return newOrg;
  };

  const role = activeTenantInfo?.user_role || activeOrg?.role || null;
  const isAdmin =
    role === 'ORGANIZATION_ADMIN' ||
    role === 'SUPER_ADMIN' ||
    Boolean(activeTenantInfo?.is_admin);
  const isDevOps =
    isAdmin ||
    role === 'DEVOPS_ENGINEER' ||
    Boolean(activeTenantInfo?.is_devops);
  const isSecurity =
    isAdmin ||
    role === 'SECURITY_ENGINEER' ||
    Boolean(activeTenantInfo?.is_security);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrg,
        activeTenantInfo,
        isLoading,
        switchOrganization,
        createOrganization,
        refreshOrganizations,
        isAdmin,
        isDevOps,
        isSecurity,
        userRole: role,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
