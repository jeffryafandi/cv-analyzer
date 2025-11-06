import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  jobId: string; // Unique job identifier
  status: "queued" | "processing" | "completed" | "failed";
  fileIds: string[]; // Array of file IDs (CVs to evaluate)
  jobTitle?: string; // Optional job title/description
  result?: {
    score?: number;
    evaluation?: string;
    recommendations?: string[];
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
