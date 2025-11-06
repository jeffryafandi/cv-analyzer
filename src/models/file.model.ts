import mongoose, { Schema, Document } from "mongoose";

export interface IFile extends Document {
  filename: string;
  originalName: string;
  fileType: "cv" | "report";
  filePath: string;
  mimeType: string;
  size: number;
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
      enum: ["cv", "report"],
      required: true,
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
