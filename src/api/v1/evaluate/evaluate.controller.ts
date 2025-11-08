import { Elysia } from "elysia";
import { JobModel } from "../../../models/job.model";
import { JobVacancyModel } from "../../../models/job-vacancy.model";
import { FileModel } from "../../../models/file.model";
import { addEvaluationJob } from "../../../jobs/evaluation.queue";
import { randomUUID } from "crypto";
import { EvaluationJobData } from "../../../types/jobs";

export const evaluateController = new Elysia().post(
  "",
  async ({ body, set }) => {
    try {
      const { vacancyId, cvId, reportId } = body as {
        vacancyId?: string;
        cvId?: string;
        reportId?: string;
      };

      // Validate input
      if (!vacancyId || !cvId) {
        set.status = 400;
        return {
          success: false,
          error: "vacancyId and cvId are required",
        };
      }

      // Validate vacancy exists and is active
      const vacancy = await JobVacancyModel.findOne({ vacancyId });
      if (!vacancy) {
        set.status = 404;
        return {
          success: false,
          error: `Job vacancy with ID ${vacancyId} not found`,
        };
      }

      if (vacancy.status !== "active") {
        set.status = 400;
        return {
          success: false,
          error: `Job vacancy with ID ${vacancyId} is not active`,
        };
      }

      // Validate CV file exists
      const cvFile = await FileModel.findById(cvId);
      if (!cvFile) {
        set.status = 404;
        return {
          success: false,
          error: `CV file with ID ${cvId} not found`,
        };
      }

      // Validate report file if provided or required
      let reportFile = null;
      if (reportId) {
        reportFile = await FileModel.findById(reportId);
        if (!reportFile) {
          set.status = 404;
          return {
            success: false,
            error: `Report file with ID ${reportId} not found`,
          };
        }
      }

      // Validate report requirement based on vacancy type
      if (vacancy.type === "cv_with_test" && !reportId) {
        set.status = 400;
        return {
          success: false,
          error: "reportId is required for cv_with_test job vacancies",
        };
      }

      // Generate unique job ID
      const jobId = randomUUID();

      // Prepare file IDs array
      const fileIds = reportId ? [cvId, reportId] : [cvId];

      // Create job document in MongoDB
      const job = await JobModel.create({
        jobId,
        status: "queued",
        fileIds,
        vacancyId,
      });

      // Add job to BullMQ queue
      await addEvaluationJob({
        jobId,
        cvId,
        reportId: reportId || "",
        vacancyId,
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
      set.status = 500;
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
        "Creates an evaluation job for a specific job vacancy, stores it in MongoDB, and adds it to the BullMQ queue. Returns job ID and status.",
      tags: ["Evaluate"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["vacancyId", "cvId"],
              properties: {
                vacancyId: {
                  type: "string",
                  description: "ID of the job vacancy to evaluate against",
                },
                cvId: {
                  type: "string",
                  description: "ID of the uploaded CV file",
                },
                reportId: {
                  type: "string",
                  description:
                    "ID of the uploaded project report file (required if vacancy type is cv_with_test)",
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
        400: {
          description: "Bad request - validation error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
        404: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  }
);
