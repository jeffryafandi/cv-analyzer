/**
 * Types for services
 */

import { JobType, FileType } from "./common";
import { StandardizedRubric } from "../models/job-vacancy.model";

export type { FileType };
export type { StandardizedRubric };

/**
 * Result type for job vacancy ingestion
 */
export interface JobVacancyIngestionResult {
  jobDescriptionText: string;
  cvRubricText: string;
  caseStudyBriefText?: string;
  projectRubricText?: string;
  cvEvaluationQueries: string[];
  projectEvaluationQueries?: string[];
  standardizedCvRubric: StandardizedRubric;
  standardizedProjectRubric?: StandardizedRubric;
}

/**
 * Document texts for evaluation query generation
 */
export interface DocumentTexts {
  jobDescription?: string;
  cvRubric?: string;
  caseStudyBrief?: string;
  projectRubric?: string;
}

/**
 * Evaluation queries result
 */
export interface EvaluationQueries {
  cvEvaluationQueries: string[];
  projectEvaluationQueries?: string[];
}

/**
 * CV evaluation result from LLM
 */
export interface CVEvaluationResult {
  technical_skills: number;
  experience_level: number;
  achievements: number;
  cultural_fit: number;
  feedback: string;
}

/**
 * Project evaluation result from LLM
 */
export interface ProjectEvaluationResult {
  correctness: number;
  code_quality: number;
  resilience: number;
  documentation: number;
  creativity: number;
  feedback: string;
}

/**
 * CV evaluation results for summary
 */
export interface CVResults {
  cv_match_rate: number;
  cv_feedback: string;
  cv_detailed_scores?: {
    technical_skills: number;
    experience_level: number;
    achievements: number;
    cultural_fit: number;
  };
}

/**
 * Project evaluation results for summary
 */
export interface ProjectResults {
  project_score: number;
  project_feedback: string;
  project_detailed_scores?: {
    correctness: number;
    code_quality: number;
    resilience: number;
    documentation: number;
    creativity: number;
  };
}

/**
 * Summary result from LLM
 */
export interface SummaryResult {
  overall_summary: string;
}

/**
 * Vector DB query result with similarity score
 */
export interface VectorDBResultWithSimilarity {
  text: string;
  metadata?: Record<string, unknown>;
  similarity: number;
}

/**
 * Vector DB query result
 */
export interface VectorDBResult {
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collection document
 */
export interface CollectionDocument {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collection info
 */
export interface CollectionInfo {
  name: string;
  count: number;
  metadata?: Record<string, unknown>;
}
