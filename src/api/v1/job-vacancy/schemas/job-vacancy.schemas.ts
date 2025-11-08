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
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                vacancyId: { type: "string" as const },
                status: { type: "string" as const },
                message: { type: "string" as const },
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

export const listJobVacanciesSchema = {
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
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                data: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      id: {
                        type: "string" as const,
                        description: "Job vacancy ID",
                      },
                      title: {
                        type: "string" as const,
                        description: "Job vacancy title",
                      },
                      description: {
                        type: "string" as const,
                        description: "Job vacancy description",
                      },
                      type: {
                        type: "string" as const,
                        enum: ["cv_only", "cv_with_test"],
                      },
                      status: {
                        type: "string" as const,
                        enum: [
                          "pending",
                          "processing",
                          "active",
                          "inactive",
                          "failed",
                        ],
                      },
                    },
                  },
                },
                pagination: {
                  type: "object" as const,
                  properties: {
                    page: { type: "number" as const },
                    limit: { type: "number" as const },
                    total: { type: "number" as const },
                    totalPages: { type: "number" as const },
                  },
                },
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

export const getJobVacancySchema = {
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
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                data: {
                  type: "object" as const,
                  properties: {
                    id: {
                      type: "string" as const,
                      description: "Job vacancy ID",
                    },
                    title: {
                      type: "string" as const,
                      description: "Job vacancy title",
                    },
                    description: {
                      type: "string" as const,
                      description: "Job vacancy description",
                    },
                    type: {
                      type: "string" as const,
                      enum: ["cv_only", "cv_with_test"],
                    },
                    status: {
                      type: "string" as const,
                      enum: [
                        "pending",
                        "processing",
                        "active",
                        "inactive",
                        "failed",
                      ],
                    },
                    jobDescription: {
                      type: "string" as const,
                      nullable: true,
                      description:
                        "Extracted PDF text content from job description (formatted as markdown, page markers removed)",
                    },
                    cvRubric: {
                      type: "string" as const,
                      nullable: true,
                      description:
                        "Extracted PDF text content from CV rubric (formatted as markdown, page markers removed)",
                    },
                    caseStudyBrief: {
                      type: "string" as const,
                      nullable: true,
                      description:
                        "Extracted PDF text content from case study brief (formatted as markdown, page markers removed)",
                    },
                    projectRubric: {
                      type: "string" as const,
                      nullable: true,
                      description:
                        "Extracted PDF text content from project rubric (formatted as markdown, page markers removed)",
                    },
                    createdAt: { type: "string" as const, format: "date-time" },
                    updatedAt: { type: "string" as const, format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
      404: {
        description: "Job vacancy not found",
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

export const updateJobVacancySchema = {
  detail: {
    summary: "Update Job Vacancy Status",
    description:
      "Updates the status of a job vacancy (active/inactive). Path parameter: id (job vacancy ID)",
    tags: ["Job Vacancy"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["status"],
            properties: {
              status: {
                type: "string" as const,
                enum: ["active", "inactive"],
                description: "New status",
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Job vacancy status updated successfully",
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
        description: "Job vacancy not found",
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
