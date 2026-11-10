export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Repository {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  html_url: string;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  is_private: boolean;
  default_branch: string;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Commit {
  id: number;
  sha: string;
  message: string;
  author_name: string;
  author_email: string | null;
  author_date: string;
  additions: number | null;
  deletions: number | null;
}

export interface PullRequest {
  id: number;
  github_id: number;
  number: number;
  title: string;
  state: string;
  author: string | null;
  url: string | null;
  created_at_gh: string | null;
  closed_at: string | null;
  merged_at: string | null;
  additions: number | null;
  deletions: number | null;
}

export interface Issue {
  id: number;
  github_id: number;
  number: number;
  title: string;
  state: string;
  author: string | null;
  labels: string | null;
  created_at_gh: string | null;
  closed_at: string | null;
}

export interface WorkflowRun {
  id: number;
  repository_id: number;
  github_id: number;
  workflow_name: string;
  run_number: number;
  status: string;
  conclusion: string | null;
  branch: string | null;
  event: string | null;
  url: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface Deployment {
  id: number;
  repository_id: number;
  github_id: number;
  environment: string;
  status: string;
  description: string | null;
  ref: string | null;
  sha: string | null;
  deployed_at: string | null;
  creator: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  reference_type: string | null;
  reference_id: number | null;
  created_at: string;
}

export interface DashboardStats {
  total_repositories: number;
  total_commits: number;
  total_pull_requests: number;
  open_issues: number;
  successful_builds: number;
  failed_builds: number;
  build_success_rate: number;
  total_deployments: number;
}

export interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  repository_name: string | null;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface BuildTrend {
  labels: string[];
  success: number[];
  failure: number[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
