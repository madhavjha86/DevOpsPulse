import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { GitHubCallbackPage } from '@/pages/GitHubCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RepositoriesPage } from '@/pages/RepositoriesPage';
import { RepositoryDetailPage } from '@/pages/RepositoryDetailPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { DeploymentsPage } from '@/pages/DeploymentsPage';
import { DoraPage } from '@/pages/DoraPage';
import { UptimePage } from '@/pages/UptimePage';
import { SecurityPage } from '@/pages/SecurityPage';
import DockerContainersPage from '@/pages/DockerContainersPage';
import KubernetesPage from '@/pages/KubernetesPage';
import CloudMonitoringPage from '@/pages/CloudMonitoringPage';
import { TelemetryPage } from '@/pages/TelemetryPage';
import { AICopilotPage } from '@/pages/AICopilotPage';
import { AICodeIntelligencePage } from '@/pages/AICodeIntelligencePage';
import { IncidentsPage } from '@/pages/IncidentsPage';
import { AIRootCauseAnalysisPage } from '@/pages/AIRootCauseAnalysisPage';
import { CloudCostPage } from '@/pages/CloudCostPage';
import { TeamProductivityPage } from '@/pages/TeamProductivityPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SettingsPage } from '@/pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />

      {/* Protected routes wrapped in Layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
        <Route path="/infrastructure/docker" element={<DockerContainersPage />} />
        <Route path="/infrastructure/kubernetes" element={<KubernetesPage />} />
        <Route path="/infrastructure/cloud" element={<CloudMonitoringPage />} />
        <Route path="/infrastructure/cost" element={<CloudCostPage />} />
        <Route path="/observability/telemetry" element={<TelemetryPage />} />
        <Route path="/ai/copilot" element={<AICopilotPage />} />
        <Route path="/ai/rca" element={<AIRootCauseAnalysisPage />} />
        <Route path="/ai/code-intelligence" element={<AICodeIntelligencePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
