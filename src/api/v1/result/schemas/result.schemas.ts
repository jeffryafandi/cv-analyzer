import { t } from "elysia";

export const getResultSchema = {
  params: t.Object({
    id: t.String(),
  }),
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
            schema: t.Union([
              t.Object({
                id: t.String(),
                status: t.Union([t.Literal("queued"), t.Literal("processing")]),
              }),
              t.Object({
                id: t.String(),
                status: t.Literal("completed"),
                result: t.Object({
                  cv_match_rate: t.Number(),
                  cv_feedback: t.String(),
                  cv_detailed_scores: t.Object({
                    technical_skills: t.Number(),
                    experience_level: t.Number(),
                    achievements: t.Number(),
                    cultural_fit: t.Number(),
                  }),
                  project_score: t.Optional(t.Number()),
                  project_feedback: t.Optional(t.String()),
                  project_detailed_scores: t.Optional(
                    t.Object({
                      correctness: t.Number(),
                      code_quality: t.Number(),
                      resilience: t.Number(),
                      documentation: t.Number(),
                      creativity: t.Number(),
                    })
                  ),
                  overall_summary: t.String(),
                }),
              }),
              t.Object({
                id: t.String(),
                status: t.Literal("failed"),
                error: t.String(),
              }),
            ]) as any,
          },
        },
      },
      404: {
        description: "Job not found",
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
