import mongoose, { Schema, Document } from "mongoose";

export interface IFile extends Document {
  filename: string;
  originalName: string;
  fileType:
    | "cv"
    | "report"
    | "job_description"
    | "case_study_brief"
    | "cv_rubric"
    | "project_rubric";
  filePath: string;
  mimeType: string;
  size: number;
  jobVacancyId?: string; // Optional reference to job vacancy (for job-related files)
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: [
        "cv",
        "report",
        "job_description",
        "case_study_brief",
        "cv_rubric",
        "project_rubric",
      ],
      required: true,
    },
    jobVacancyId: {
      type: String,
      index: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FileModel =
  mongoose.models.File || mongoose.model<IFile>("File", FileSchema);
