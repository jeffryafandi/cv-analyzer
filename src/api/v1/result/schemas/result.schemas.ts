export const getResultSchema = {
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
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    status: {
                      type: "string" as const,
                      enum: ["queued", "processing"],
                    },
                  },
                },
                {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    status: { type: "string" as const, enum: ["completed"] },
                    result: {
                      type: "object" as const,
                      properties: {
                        cv_match_rate: { type: "number" as const },
                        cv_feedback: { type: "string" as const },
                        cv_detailed_scores: {
                          type: "object" as const,
                          properties: {
                            technical_skills: { type: "number" as const },
                            experience_level: { type: "number" as const },
                            achievements: { type: "number" as const },
                            cultural_fit: { type: "number" as const },
                          },
                        },
                        project_score: { type: "number" as const },
                        project_feedback: { type: "string" as const },
                        project_detailed_scores: {
                          type: "object" as const,
                          properties: {
                            correctness: { type: "number" as const },
                            code_quality: { type: "number" as const },
                            resilience: { type: "number" as const },
                            documentation: { type: "number" as const },
                            creativity: { type: "number" as const },
                          },
                        },
                        overall_summary: { type: "string" as const },
                      },
                    },
                  },
                },
                {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    status: { type: "string" as const, enum: ["failed"] },
                    error: { type: "string" as const },
                  },
                },
              ],
            } as any,
          },
        },
      },
      404: {
        description: "Job not found",
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
