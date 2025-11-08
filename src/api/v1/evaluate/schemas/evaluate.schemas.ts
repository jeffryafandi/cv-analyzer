import { t } from "elysia";

export const createEvaluationSchema = {
  body: t.Object({
    vacancyId: t.String(),
    cvId: t.String(),
    reportId: t.Optional(t.String()),
  }),
  detail: {
    summary: "Create Evaluation Job",
    description:
      "Creates an evaluation job for a specific job vacancy, stores it in MongoDB, and adds it to the BullMQ queue. Returns job ID and status.",
    tags: ["Evaluate"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: t.Object({
            vacancyId: t.String(),
            cvId: t.String(),
            reportId: t.Optional(t.String()),
          }),
        },
      },
    },
    responses: {
      200: {
        description: "Evaluation job created successfully",
        content: {
          "application/json": {
            schema: t.Object({
              id: t.String(),
              status: t.Literal("queued"),
            }),
          },
        },
      },
      400: {
        description: "Bad request - validation error",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              error: t.String(),
            }),
          },
        },
      },
      404: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              error: t.String(),
            }),
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              error: t.String(),
            }),
          },
        },
      },
    },
  },
};
