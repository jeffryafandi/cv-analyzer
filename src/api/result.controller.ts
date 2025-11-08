import { Elysia } from "elysia";
import { JobModel } from "../models/job.model";

export const resultController = new Elysia({ prefix: "/result" }).get(
  "/:id",
  async ({ params }) => {
    try {
      const jobId = params.id;

      const job = await JobModel.findOne({ jobId });

      if (!job) {
        return {
          success: false,
          error: `Job with ID ${jobId} not found`,
        };
      }

      // If job is queued or processing, return status only
      if (job.status === "queued" || job.status === "processing") {
        return {
          id: job.jobId,
          status: job.status,
        };
      }

      // If job is completed, return full result
      if (job.status === "completed" && job.result) {
        return {
          id: job.jobId,
          status: job.status,
          result: job.result,
        };
      }

      // If job failed, return error
      if (job.status === "failed") {
        return {
          id: job.jobId,
          status: job.status,
          error: job.error || "Evaluation failed",
        };
      }

      return {
        id: job.jobId,
        status: job.status,
      };
    } catch (error) {
      console.error("Error retrieving evaluation result:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to retrieve evaluation result";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
  {
    detail: {
      summary: "Get Evaluation Result",
      description:
        "Retrieves evaluation job results from MongoDB. Returns job status and results.",
      tags: ["Result"],
      responses: {
        200: {
          description: "Evaluation job status and results",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      status: {
                        type: "string",
                        enum: ["queued", "processing"],
                      },
                    },
                  },
                  {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      status: { type: "string", enum: ["completed"] },
                      result: {
                        type: "object",
                        properties: {
                          cv_match_rate: { type: "number" },
                          cv_feedback: { type: "string" },
                          cv_detailed_scores: {
                            type: "object",
                            properties: {
                              technical_skills: { type: "number" },
                              experience_level: { type: "number" },
                              achievements: { type: "number" },
                              cultural_fit: { type: "number" },
                            },
                          },
                          project_score: { type: "number" },
                          project_feedback: { type: "string" },
                          project_detailed_scores: {
                            type: "object",
                            properties: {
                              correctness: { type: "number" },
                              code_quality: { type: "number" },
                              resilience: { type: "number" },
                              documentation: { type: "number" },
                              creativity: { type: "number" },
                            },
                          },
                          overall_summary: { type: "string" },
                        },
                      },
                    },
                  },
                  {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      status: { type: "string", enum: ["failed"] },
                      error: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  }
);
