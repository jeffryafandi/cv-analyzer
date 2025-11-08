export const createEvaluationSchema = {
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
            type: "object" as const,
            required: ["vacancyId", "cvId"],
            properties: {
              vacancyId: {
                type: "string" as const,
                description: "ID of the job vacancy to evaluate against",
              },
              cvId: {
                type: "string" as const,
                description: "ID of the uploaded CV file",
              },
              reportId: {
                type: "string" as const,
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
              type: "object" as const,
              properties: {
                id: { type: "string" as const },
                status: { type: "string" as const, enum: ["queued"] },
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
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                error: { type: "string" as const },
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
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                error: { type: "string" as const },
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
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                error: { type: "string" as const },
              },
            },
          },
        },
      },
    },
  },
};
