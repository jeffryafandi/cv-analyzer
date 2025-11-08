import { t } from "elysia";

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
            schema: t.Object({
              success: t.Boolean(),
              message: t.String(),
              cvId: t.String(),
              reportId: t.Optional(t.String()),
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
              cvId: t.Optional(t.String()),
              reportId: t.Optional(t.String()),
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
              cvId: t.Optional(t.String()),
              reportId: t.Optional(t.String()),
            }),
          },
        },
      },
    },
  },
};
