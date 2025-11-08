/**
 * Types for job queues and workers
 */

import { JobType } from "./common";

export interface JobVacancyIngestionJobData {
  vacancyId: string;
  jobDescriptionFileId: string;
  cvRubricFileId: string;
  caseStudyBriefFileId?: string;
  projectRubricFileId?: string;
  type: JobType;
}

export interface EvaluationJobData {
  jobId: string;
  cvId: string;
  reportId: string;
  vacancyId: string;
}
