import api from './api';

export interface PRReviewFinding {
  file: string;
  line?: number | null;
  category: 'SECURITY' | 'PERFORMANCE' | 'CODE_QUALITY' | 'TEST_COVERAGE';
  severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION' | 'INFO';
  message: string;
  suggestion_diff?: string | null;
}

export interface AIPullRequestReview {
  id: number;
  pull_request_id?: number | null;
  repository_id?: number | null;
  pr_number: number;
  pr_title: string;
  review_verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  summary: string;
  findings: PRReviewFinding[];
  security_score: number;
  created_at: string;
}

export interface AIFailurePrediction {
  id: number;
  repository_id?: number | null;
  commit_sha: string;
  branch: string;
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_factors: string[];
  recommendations: string[];
  created_at: string;
}

export interface GeneratePRReviewPayload {
  pull_request_id?: number | null;
  repository_id?: number | null;
  pr_number: number;
  pr_title?: string;
  diff_content?: string;
}

export interface PredictFailurePayload {
  repository_id?: number | null;
  commit_sha?: string;
  branch?: string;
  changed_files?: string[];
  additions?: number;
  deletions?: number;
}

export const aiCodeIntelligenceService = {
  reviewPullRequest: async (
    payload: GeneratePRReviewPayload
  ): Promise<AIPullRequestReview> => {
    const res = await api.post<AIPullRequestReview>(
      '/api/v1/ai/intelligence/reviews/generate',
      payload
    );
    return res.data;
  },

  listPRReviews: async (limit: number = 50): Promise<AIPullRequestReview[]> => {
    const res = await api.get<AIPullRequestReview[]>('/api/v1/ai/intelligence/reviews', {
      params: { limit },
    });
    return res.data;
  },

  predictFailure: async (
    payload: PredictFailurePayload
  ): Promise<AIFailurePrediction> => {
    const res = await api.post<AIFailurePrediction>(
      '/api/v1/ai/intelligence/predictions/evaluate',
      payload
    );
    return res.data;
  },

  listPredictions: async (limit: number = 50): Promise<AIFailurePrediction[]> => {
    const res = await api.get<AIFailurePrediction[]>('/api/v1/ai/intelligence/predictions', {
      params: { limit },
    });
    return res.data;
  },
};
