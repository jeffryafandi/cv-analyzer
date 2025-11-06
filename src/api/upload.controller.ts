import { Elysia } from "elysia";
import { saveFile } from "../services/storage.service";
import { FileModel } from "../models/file.model";

export const uploadController = new Elysia({ prefix: "/upload" }).post(
  "",
  async ({ request }) => {
    try {
      // Get the content type to check if it's multipart
      const contentType = request.headers.get("content-type") || "";

      // Only attempt to parse if content-type is multipart/form-data
      if (!contentType.includes("multipart/form-data")) {
        return {
          success: false,
          error:
            "Content-Type must be multipart/form-data. This endpoint only accepts file uploads.",
          cvId: null,
          reportId: null,
        };
      }

      // Parse multipart form data
      // Bun should handle this automatically if content-type is correct
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch (error) {
        // If formData parsing fails, return helpful error
        console.error("FormData parsing error:", error);
        return {
          success: false,
          error:
            "Failed to parse multipart form data. Please ensure Content-Type is multipart/form-data with proper boundary.",
          cvId: null,
          reportId: null,
        };
      }

      const cvFile = formData.get("cv") as File | null;
      const reportFile = formData.get("report") as File | null;

      if (!cvFile || !reportFile) {
        return {
          success: false,
          error: "Both CV and Report files are required",
          cvId: null,
          reportId: null,
        };
      }

      // Validate file types (should be PDFs)
      const allowedMimeTypes = ["application/pdf"];
      if (!allowedMimeTypes.includes(cvFile.type)) {
        return {
          success: false,
          error: "CV file must be a PDF",
          cvId: null,
          reportId: null,
        };
      }
      if (!allowedMimeTypes.includes(reportFile.type)) {
        return {
          success: false,
          error: "Report file must be a PDF",
          cvId: null,
          reportId: null,
        };
      }

      // Save CV file
      const { filePath: cvFilePath, filename: cvFilename } = await saveFile(
        cvFile,
        "cv"
      );

      // Save Report file
      const { filePath: reportFilePath, filename: reportFilename } =
        await saveFile(reportFile, "report");

      // Save file metadata to MongoDB
      const cvDocument = await FileModel.create({
        filename: cvFilename,
        originalName: cvFile.name,
        fileType: "cv",
        filePath: cvFilePath,
        mimeType: cvFile.type,
        size: cvFile.size,
      });

      const reportDocument = await FileModel.create({
        filename: reportFilename,
        originalName: reportFile.name,
        fileType: "report",
        filePath: reportFilePath,
        mimeType: reportFile.type,
        size: reportFile.size,
      });

      return {
        success: true,
        message: "Files uploaded successfully",
        cvId: cvDocument._id.toString(),
        reportId: reportDocument._id.toString(),
      };
    } catch (error) {
      console.error("Error uploading files:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload files";
      return {
        success: false,
        error: errorMessage,
        cvId: null,
        reportId: null,
      };
    }
  },
  {
    detail: {
      summary: "Upload CV and Project Report",
      description:
        "Handles file uploads for CV and Project Report PDFs. Returns unique IDs for uploaded files. Accepts multipart/form-data with 'cv' and 'report' fields.",
      tags: ["Upload"],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["cv", "report"],
              properties: {
                cv: {
                  type: "string",
                  format: "binary",
                  description: "CV PDF file",
                },
                report: {
                  type: "string",
                  format: "binary",
                  description: "Project Report PDF file",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Files uploaded successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  message: { type: "string" },
                  cvId: { type: "string" },
                  reportId: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  }
);
