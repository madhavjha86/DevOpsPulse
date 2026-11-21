import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Dynamic lazy imports for route code-splitting
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const GitHubCallbackPage = lazy(() => import('@/pages/GitHubCallbackPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const RepositoriesPage = lazy(() => import('@/pages/RepositoriesPage'));
const RepositoryDetailPage = lazy(() => import('@/pages/RepositoryDetailPage'));
const WorkflowsPage = lazy(() => import('@/pages/WorkflowsPage'));
const DeploymentsPage = lazy(() => import('@/pages/DeploymentsPage'));
const DoraPage = lazy(() => import('@/pages/DoraPage'));
const TeamProductivityPage = lazy(() => import('@/pages/TeamProductivityPage'));
const IncidentsPage = lazy(() => import('@/pages/IncidentsPage'));
const UptimePage = lazy(() => import('@/pages/UptimePage'));
const SecurityPage = lazy(() => import('@/pages/SecurityPage'));
const DeveloperPortalPage = lazy(() => import('@/pages/DeveloperPortalPage'));
const DisasterRecoveryPage = lazy(() => import('@/pages/DisasterRecoveryPage'));
const DockerContainersPage = lazy(() => import('@/pages/DockerContainersPage'));
const KubernetesPage = lazy(() => import('@/pages/KubernetesPage'));
const CloudMonitoringPage = lazy(() => import('@/pages/CloudMonitoringPage'));
const CloudCostPage = lazy(() => import('@/pages/CloudCostPage'));
const TelemetryPage = lazy(() => import('@/pages/TelemetryPage'));
const AICopilotPage = lazy(() => import('@/pages/AICopilotPage'));
const AIRootCauseAnalysisPage = lazy(() => import('@/pages/AIRootCauseAnalysisPage'));
const AICodeIntelligencePage = lazy(() => import('@/pages/AICodeIntelligencePage'));
const AIGovernancePage = lazy(() => import('@/pages/AIGovernancePage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const OrganizationSettingsPage = lazy(() => import('@/pages/OrganizationSettingsPage'));

const PageFallback: React.FC = () => (
  <div className="flex h-96 w-full items-center justify-center">
    <LoadingSpinner size="lg" message="Loading interface..." />
  </div>
);

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        {/* Public Marketing & Authentication routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
        <Route path="/invitations/accept" element={<AcceptInvitationPage />} />

        {/* Protected routes wrapped in Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/repositories/:id" element={<RepositoryDetailPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/deployments" element={<DeploymentsPage />} />
          <Route path="/dora" element={<DoraPage />} />
          <Route path="/analytics/team-productivity" element={<TeamProductivityPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/uptime" element={<UptimePage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/developer-portal" element={<DeveloperPortalPage />} />
          <Route path="/disaster-recovery" element={<DisasterRecoveryPage />} />
          <Route path="/infrastructure/docker" element={<DockerContainersPage />} />
          <Route path="/infrastructure/kubernetes" element={<KubernetesPage />} />
          <Route path="/infrastructure/cloud" element={<CloudMonitoringPage />} />
          <Route path="/infrastructure/cost" element={<CloudCostPage />} />
          <Route path="/observability/telemetry" element={<TelemetryPage />} />
          <Route path="/ai/copilot" element={<AICopilotPage />} />
          <Route path="/ai/rca" element={<AIRootCauseAnalysisPage />} />
          <Route path="/ai/code-intelligence" element={<AICodeIntelligencePage />} />
          <Route path="/ai/governance" element={<AIGovernancePage />} />
          <Route path="/organization/ai-governance" element={<AIGovernancePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/organization" element={<OrganizationSettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>
  );
};

export default App;
