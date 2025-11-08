/**
 * Common types shared across the application
 */

export type JobType = "cv_only" | "cv_with_test";

export type JobVacancyStatus =
  | "pending"
  | "processing"
  | "active"
  | "inactive"
  | "failed";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type FileType =
  | "cv"
  | "report"
  | "job_description"
  | "case_study_brief"
  | "cv_rubric"
  | "project_rubric";
