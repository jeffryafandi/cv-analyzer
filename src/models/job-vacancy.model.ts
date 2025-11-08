import mongoose, { Schema, Document } from "mongoose";

export interface StandardizedRubric {
  technical_skills?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  experience_level?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  achievements?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  cultural_fit?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  // Project rubric fields
  correctness?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  code_quality?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  resilience?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  documentation?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
  creativity?: {
    weight: number;
    criteria: string;
    scale: { [key: number]: string };
  };
}

export interface IJobVacancy extends Document {
  vacancyId: string; // Unique vacancy identifier
  title: string;
  description?: string;
  type: "cv_only" | "cv_with_test";
  status: "pending" | "processing" | "active" | "inactive" | "failed";
  // File references
  jobDescriptionFileId: string;
  cvRubricFileId: string;
  caseStudyBriefFileId?: string; // Required if type === "cv_with_test"
  projectRubricFileId?: string; // Required if type === "cv_with_test"
  // AI-generated data
  standardizedCvRubric: StandardizedRubric;
  standardizedProjectRubric?: StandardizedRubric; // Only if type === "cv_with_test"
  cvEvaluationQueries: string[]; // Array of query strings for CV evaluation
  projectEvaluationQueries?: string[]; // Array of query strings for project evaluation
  createdAt: Date;
  updatedAt: Date;
}

const JobVacancySchema = new Schema<IJobVacancy>(
  {
    vacancyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ["cv_only", "cv_with_test"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "active", "inactive", "failed"],
      default: "pending",
      required: true,
      index: true,
    },
    jobDescriptionFileId: {
      type: String,
      required: true,
    },
    cvRubricFileId: {
      type: String,
      required: true,
    },
    caseStudyBriefFileId: {
      type: String,
    },
    projectRubricFileId: {
      type: String,
    },
    standardizedCvRubric: {
      type: Schema.Types.Mixed,
    },
    standardizedProjectRubric: {
      type: Schema.Types.Mixed,
    },
    cvEvaluationQueries: {
      type: [String],
      default: [],
    },
    projectEvaluationQueries: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const JobVacancyModel =
  mongoose.models.JobVacancy ||
  mongoose.model<IJobVacancy>("JobVacancy", JobVacancySchema);
