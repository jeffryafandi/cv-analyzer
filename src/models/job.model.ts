import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  jobId: string; // Unique job identifier
  status: "queued" | "processing" | "completed" | "failed";
  fileIds: string[]; // Array of file IDs (CVs to evaluate)
  jobTitle: string; // Job title/description
  result?: {
    cv_match_rate: number; // 0-1 decimal
    cv_feedback: string;
    cv_detailed_scores?: {
      technical_skills: number; // 1-5
      experience_level: number;
      achievements: number;
      cultural_fit: number;
    };
    project_score: number; // 1-5 average
    project_feedback: string;
    project_detailed_scores?: {
      correctness: number; // 1-5
      code_quality: number;
      resilience: number;
      documentation: number;
      creativity: number;
    };
    overall_summary: string;
    [key: string]: unknown;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      required: true,
    },
    fileIds: {
      type: [String],
      required: true,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    result: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const JobModel =
  mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);
