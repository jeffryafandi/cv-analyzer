import { Elysia } from "elysia";
import { JobModel } from "../models/job.model";
import { FileModel } from "../models/file.model";
import { addEvaluationJob } from "../jobs/evaluation.queue";
import { randomUUID } from "crypto";

export const evaluateController = new Elysia({ prefix: "/evaluate" }).post(
  "/",
  async ({ body }) => {
    try {
      const { jobTitle, cvId, reportId } = body as {
        jobTitle?: string;
        cvId?: string;
        reportId?: string;
      };

      // Validate input
      if (!jobTitle || !cvId || !reportId) {
        return {
          success: false,
          error: "jobTitle, cvId, and reportId are required",
        };
      }

      // Validate files exist
      const cvFile = await FileModel.findById(cvId);
      const reportFile = await FileModel.findById(reportId);

      if (!cvFile) {
        return {
          success: false,
          error: `CV file with ID ${cvId} not found`,
        };
      }

      if (!reportFile) {
        return {
          success: false,
          error: `Report file with ID ${reportId} not found`,
        };
      }

      // Generate unique job ID
      const jobId = randomUUID();

      // Create job document in MongoDB
      const job = await JobModel.create({
        jobId,
        status: "queued",
        fileIds: [cvId, reportId],
        jobTitle,
      });

      // Add job to BullMQ queue
      await addEvaluationJob({
        jobId,
        cvId,
        reportId,
        jobTitle,
      });

      return {
        id: jobId,
        status: "queued",
      };
    } catch (error) {
      console.error("Error creating evaluation job:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create evaluation job";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
  {
    detail: {
      summary: "Create Evaluation Job",
      description:
        "Creates an evaluation job, stores it in MongoDB, and adds it to the BullMQ queue. Returns job ID and status.",
      tags: ["Evaluate"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["jobTitle", "cvId", "reportId"],
              properties: {
                jobTitle: {
                  type: "string",
                  description: "Job title or description",
                },
                cvId: {
                  type: "string",
                  description: "ID of the uploaded CV file",
                },
                reportId: {
                  type: "string",
                  description: "ID of the uploaded project report file",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Evaluation job created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  status: { type: "string", enum: ["queued"] },
                },
              },
            },
          },
        },
      },
    },
  }
);
