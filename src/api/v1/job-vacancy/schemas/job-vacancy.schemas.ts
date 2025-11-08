import { t } from "elysia";

export const createJobVacancySchema = {
  detail: {
    summary: "Create Job Vacancy",
    description:
      "Creates a new job vacancy with uploaded documents. Processes documents, generates evaluation queries, and standardizes rubrics using AI.",
    tags: ["Job Vacancy"],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object" as const,
            required: ["title", "type", "jobDescription", "cvRubric"],
            properties: {
              title: {
                type: "string" as const,
                description: "Job vacancy title",
              },
              description: {
                type: "string" as const,
                description: "Optional job description",
              },
              type: {
                type: "string" as const,
                enum: ["cv_only", "cv_with_test"],
                description: "Job type",
              },
              jobDescription: {
                type: "string" as const,
                format: "binary",
                description: "Job description PDF (required)",
              },
              cvRubric: {
                type: "string" as const,
                format: "binary",
                description: "CV scoring rubric PDF (required)",
              },
              caseStudyBrief: {
                type: "string" as const,
                format: "binary",
                description:
                  "Case study brief PDF (required if type is cv_with_test)",
              },
              projectRubric: {
                type: "string" as const,
                format: "binary",
                description:
                  "Project scoring rubric PDF (required if type is cv_with_test)",
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Job vacancy created successfully",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              vacancyId: t.String(),
              status: t.String(),
              message: t.String(),
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

export const listJobVacanciesSchema = {
  query: t.Object({
    status: t.Optional(
      t.Union([
        t.Literal("pending"),
        t.Literal("processing"),
        t.Literal("active"),
        t.Literal("inactive"),
        t.Literal("failed"),
      ])
    ),
    type: t.Optional(
      t.Union([t.Literal("cv_only"), t.Literal("cv_with_test")])
    ),
    page: t.Optional(t.Number({ minimum: 1 })),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  }),
  detail: {
    summary: "List Job Vacancies",
    description:
      "Lists all job vacancies with optional filtering and pagination. Query parameters: status (active|inactive), type (cv_only|cv_with_test), page (number), limit (number)",
    tags: ["Job Vacancy"],
    responses: {
      200: {
        description: "Job vacancies retrieved successfully",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              data: t.Array(
                t.Object({
                  id: t.String(),
                  title: t.String(),
                  description: t.Optional(t.String()),
                  type: t.Union([
                    t.Literal("cv_only"),
                    t.Literal("cv_with_test"),
                  ]),
                  status: t.Union([
                    t.Literal("pending"),
                    t.Literal("processing"),
                    t.Literal("active"),
                    t.Literal("inactive"),
                    t.Literal("failed"),
                  ]),
                })
              ),
              pagination: t.Object({
                page: t.Number(),
                limit: t.Number(),
                total: t.Number(),
                totalPages: t.Number(),
              }),
            }) as any,
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

export const getJobVacancySchema = {
  params: t.Object({
    id: t.String(),
  }),
  detail: {
    summary: "Get Job Vacancy",
    description:
      "Gets a specific job vacancy by ID with all details including file contents extracted from PDFs",
    tags: ["Job Vacancy"],
    responses: {
      200: {
        description: "Job vacancy retrieved successfully",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              data: t.Object({
                id: t.String(),
                title: t.String(),
                description: t.Optional(t.String()),
                type: t.Union([
                  t.Literal("cv_only"),
                  t.Literal("cv_with_test"),
                ]),
                status: t.Union([
                  t.Literal("pending"),
                  t.Literal("processing"),
                  t.Literal("active"),
                  t.Literal("inactive"),
                  t.Literal("failed"),
                ]),
                jobDescription: t.Union([t.String(), t.Null()]),
                cvRubric: t.Union([t.String(), t.Null()]),
                caseStudyBrief: t.Optional(t.Union([t.String(), t.Null()])),
                projectRubric: t.Optional(t.Union([t.String(), t.Null()])),
                createdAt: t.String(),
                updatedAt: t.String(),
              }),
            }) as any,
          },
        },
      },
      404: {
        description: "Job vacancy not found",
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

export const updateJobVacancySchema = {
  params: t.Object({
    id: t.String(),
  }),
  body: t.Object({
    status: t.Union([t.Literal("active"), t.Literal("inactive")]),
  }),
  detail: {
    summary: "Update Job Vacancy Status",
    description:
      "Updates the status of a job vacancy (active/inactive). Path parameter: id (job vacancy ID)",
    tags: ["Job Vacancy"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: t.Object({
            status: t.Union([t.Literal("active"), t.Literal("inactive")]),
          }),
        },
      },
    },
    responses: {
      200: {
        description: "Job vacancy status updated successfully",
        content: {
          "application/json": {
            schema: t.Object({
              success: t.Boolean(),
              vacancyId: t.String(),
              status: t.String(),
              message: t.String(),
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
        description: "Job vacancy not found",
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
