export const uploadSchema = {
  detail: {
    summary: "Upload Applicant CV and Project Report",
    description:
      "Handles file uploads for applicant CV (required) and optional Project Report PDFs. Returns unique IDs for uploaded files. Accepts multipart/form-data with 'cv' (required) and 'report' (optional) fields.",
    tags: ["Upload"],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object" as const,
            required: ["cv"],
            properties: {
              cv: {
                type: "string" as const,
                format: "binary",
                description: "CV PDF file (required)",
              },
              report: {
                type: "string" as const,
                format: "binary",
                description: "Project Report PDF file (optional)",
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
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                message: { type: "string" as const },
                cvId: { type: "string" as const },
                reportId: { type: "string" as const, nullable: true },
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
                cvId: { type: "string" as const, nullable: true },
                reportId: { type: "string" as const, nullable: true },
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
                cvId: { type: "string" as const, nullable: true },
                reportId: { type: "string" as const, nullable: true },
              },
            },
          },
        },
      },
    },
  },
};
