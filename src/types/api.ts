/**
 * Types for API controllers
 */

import { JobType, JobVacancyStatus } from "./common";

/**
 * Create job vacancy request body
 */
export interface CreateJobVacancyRequest {
  title: string;
  description?: string;
  type: JobType;
  jobDescription: File;
  cvRubric: File;
  caseStudyBrief?: File;
  projectRubric?: File;
}

/**
 * Create job vacancy response
 */
export interface CreateJobVacancyResponse {
  success: boolean;
  vacancyId?: string;
  status?: JobVacancyStatus;
  message?: string;
  error?: string;
}

/**
 * List job vacancies query parameters
 */
export interface ListJobVacanciesQuery {
  status?: JobVacancyStatus;
  type?: JobType;
  page?: string;
  limit?: string;
}

/**
 * List job vacancies response
 */
export interface ListJobVacanciesResponse {
  success: boolean;
  data?: unknown[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Get job vacancy response
 */
export interface GetJobVacancyResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Update job vacancy status request body
 */
export interface UpdateJobVacancyStatusRequest {
  status: "active" | "inactive";
}

/**
 * Update job vacancy status response
 */
export interface UpdateJobVacancyStatusResponse {
  success: boolean;
  vacancyId?: string;
  status?: JobVacancyStatus;
  message?: string;
  error?: string;
}

/**
 * Create evaluation job request body
 */
export interface CreateEvaluationJobRequest {
  vacancyId: string;
  cvId: string;
  reportId?: string;
}

/**
 * Create evaluation job response
 */
export interface CreateEvaluationJobResponse {
  id?: string;
  status?: "queued";
  success?: boolean;
  error?: string;
}

/**
 * Upload files request
 */
export interface UploadFilesRequest {
  cv: File;
  report?: File;
}

/**
 * Upload files response
 */
export interface UploadFilesResponse {
  success: boolean;
  message?: string;
  cvId?: string | null;
  reportId?: string | null;
  error?: string;
}

/**
 * Get evaluation result response
 */
export interface GetEvaluationResultResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  result?: {
    cv_match_rate: number;
    cv_feedback: string;
    cv_detailed_scores?: {
      technical_skills: number;
      experience_level: number;
      achievements: number;
      cultural_fit: number;
    };
    project_score?: number;
    project_feedback?: string;
    project_detailed_scores?: {
      correctness: number;
      code_quality: number;
      resilience: number;
      documentation: number;
      creativity: number;
    };
    overall_summary: string;
  };
  error?: string;
  success?: boolean;
}
