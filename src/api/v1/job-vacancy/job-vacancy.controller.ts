import { Elysia } from "elysia";
import { JobVacancyModel } from "../../../models/job-vacancy.model";
import { FileModel } from "../../../models/file.model";
import { saveFile } from "../../../services/storage.service";
import { addJobVacancyIngestionJob } from "../../../jobs/job-vacancy-ingestion.queue";
import { randomUUID } from "crypto";
import { JobType, JobVacancyStatus } from "../../../types/common";

export const jobVacancyController = new Elysia()
  // POST /api/v1/job-vacancy - Create new job vacancy
  .post(
    "",
    async ({ request, set }) => {
      try {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
          set.status = 400;
          return {
            success: false,
            error:
              "Content-Type must be multipart/form-data. This endpoint only accepts file uploads.",
          };
        }

        const formData = await request.formData();

        // Extract form fields
        const title = formData.get("title") as string | null;
        const description = formData.get("description") as string | null;
        const type = formData.get("type") as JobType | null;

        // Extract files
        const jobDescriptionFile = formData.get(
          "jobDescription"
        ) as File | null;
        const cvRubricFile = formData.get("cvRubric") as File | null;
        const caseStudyBriefFile = formData.get(
          "caseStudyBrief"
        ) as File | null;
        const projectRubricFile = formData.get("projectRubric") as File | null;

        // Validate required fields
        if (!title || !type) {
          set.status = 400;
          return {
            success: false,
            error: "title and type are required",
          };
        }

        if (type !== "cv_only" && type !== "cv_with_test") {
          set.status = 400;
          return {
            success: false,
            error: "type must be either 'cv_only' or 'cv_with_test'",
          };
        }

        // Validate required files
        if (!jobDescriptionFile || !cvRubricFile) {
          set.status = 400;
          return {
            success: false,
            error: "jobDescription and cvRubric files are required",
          };
        }

        // Validate files for cv_with_test type
        if (type === "cv_with_test") {
          if (!caseStudyBriefFile || !projectRubricFile) {
            set.status = 400;
            return {
              success: false,
              error:
                "caseStudyBrief and projectRubric files are required for cv_with_test type",
            };
          }
        }

        // Validate file types (should be PDFs)
        const allowedMimeTypes = ["application/pdf"];
        const filesToCheck = [
          { file: jobDescriptionFile, name: "jobDescription" },
          { file: cvRubricFile, name: "cvRubric" },
          ...(type === "cv_with_test"
            ? [
                { file: caseStudyBriefFile!, name: "caseStudyBrief" },
                { file: projectRubricFile!, name: "projectRubric" },
              ]
            : []),
        ];

        for (const { file, name } of filesToCheck) {
          if (file && !allowedMimeTypes.includes(file.type)) {
            set.status = 400;
            return {
              success: false,
              error: `${name} file must be a PDF`,
            };
          }
        }

        // Generate unique vacancy ID
        const vacancyId = randomUUID();

        // Save files
        const { filePath: jobDescPath, filename: jobDescFilename } =
          await saveFile(jobDescriptionFile, "job_description");
        const { filePath: cvRubricPath, filename: cvRubricFilename } =
          await saveFile(cvRubricFile, "cv_rubric");

        const jobDescDoc = await FileModel.create({
          filename: jobDescFilename,
          originalName: jobDescriptionFile.name,
          fileType: "job_description",
          filePath: jobDescPath,
          mimeType: jobDescriptionFile.type,
          size: jobDescriptionFile.size,
          jobVacancyId: vacancyId,
        });

        const cvRubricDoc = await FileModel.create({
          filename: cvRubricFilename,
          originalName: cvRubricFile.name,
          fileType: "cv_rubric",
          filePath: cvRubricPath,
          mimeType: cvRubricFile.type,
          size: cvRubricFile.size,
          jobVacancyId: vacancyId,
        });

        let caseStudyBriefDoc = null;
        let projectRubricDoc = null;

        if (
          type === "cv_with_test" &&
          caseStudyBriefFile &&
          projectRubricFile
        ) {
          const { filePath: caseStudyPath, filename: caseStudyFilename } =
            await saveFile(caseStudyBriefFile, "case_study_brief");
          const {
            filePath: projectRubricPath,
            filename: projectRubricFilename,
          } = await saveFile(projectRubricFile, "project_rubric");

          caseStudyBriefDoc = await FileModel.create({
            filename: caseStudyFilename,
            originalName: caseStudyBriefFile.name,
            fileType: "case_study_brief",
            filePath: caseStudyPath,
            mimeType: caseStudyBriefFile.type,
            size: caseStudyBriefFile.size,
            jobVacancyId: vacancyId,
          });

          projectRubricDoc = await FileModel.create({
            filename: projectRubricFilename,
            originalName: projectRubricFile.name,
            fileType: "project_rubric",
            filePath: projectRubricPath,
            mimeType: projectRubricFile.type,
            size: projectRubricFile.size,
            jobVacancyId: vacancyId,
          });
        }

        // Create job vacancy document with pending status
        const jobVacancy = await JobVacancyModel.create({
          vacancyId,
          title,
          description: description || undefined,
          type,
          status: "pending",
          jobDescriptionFileId: jobDescDoc._id.toString(),
          cvRubricFileId: cvRubricDoc._id.toString(),
          caseStudyBriefFileId: caseStudyBriefDoc?._id.toString(),
          projectRubricFileId: projectRubricDoc?._id.toString(),
        });

        // Add job to ingestion queue for asynchronous processing
        console.log(`Adding job vacancy ${vacancyId} to ingestion queue...`);
        await addJobVacancyIngestionJob({
          vacancyId,
          jobDescriptionFileId: jobDescDoc._id.toString(),
          cvRubricFileId: cvRubricDoc._id.toString(),
          caseStudyBriefFileId: caseStudyBriefDoc?._id.toString(),
          projectRubricFileId: projectRubricDoc?._id.toString(),
          type,
        });

        return {
          success: true,
          vacancyId: jobVacancy.vacancyId,
          status: jobVacancy.status,
          message: "Job vacancy created and queued for processing",
        };
      } catch (error) {
        console.error("Error creating job vacancy:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create job vacancy";
        set.status = 500;
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    {
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
                type: "object",
                required: ["title", "type", "jobDescription", "cvRubric"],
                properties: {
                  title: {
                    type: "string",
                    description: "Job vacancy title",
                  },
                  description: {
                    type: "string",
                    description: "Optional job description",
                  },
                  type: {
                    type: "string",
                    enum: ["cv_only", "cv_with_test"],
                    description: "Job type",
                  },
                  jobDescription: {
                    type: "string",
                    format: "binary",
                    description: "Job description PDF (required)",
                  },
                  cvRubric: {
                    type: "string",
                    format: "binary",
                    description: "CV scoring rubric PDF (required)",
                  },
                  caseStudyBrief: {
                    type: "string",
                    format: "binary",
                    description:
                      "Case study brief PDF (required if type is cv_with_test)",
                  },
                  projectRubric: {
                    type: "string",
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
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    vacancyId: { type: "string" },
                    status: { type: "string" },
                    message: { type: "string" },
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
  )
  // GET /api/v1/job-vacancy - List all job vacancies
  .get(
    "",
    async ({ query, set }) => {
      try {
        const status = query.status as JobVacancyStatus | undefined;
        const type = query.type as JobType | undefined;
        const page = parseInt(query.page as string) || 1;
        const limit = parseInt(query.limit as string) || 10;

        // Build filter
        const filter: Record<string, unknown> = {};
        if (status) {
          filter.status = status;
        }
        if (type) {
          filter.type = type;
        }

        // Get total count
        const total = await JobVacancyModel.countDocuments(filter);

        // Get paginated results
        const vacancies = await JobVacancyModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select(
            "-standardizedCvRubric -standardizedProjectRubric -cvEvaluationQueries -projectEvaluationQueries"
          )
          .lean();

        return {
          success: true,
          data: vacancies,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        console.error("Error listing job vacancies:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to list job vacancies";
        set.status = 500;
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    {
      detail: {
        summary: "List Job Vacancies",
        description:
          "Lists all job vacancies with optional filtering and pagination. Query parameters: status (active|inactive), type (cv_only|cv_with_test), page (number), limit (number)",
        tags: ["Job Vacancy"],
        responses: {
          200: {
            description: "Job vacancies retrieved successfully",
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
  )
  // GET /api/v1/job-vacancy/:id - Get specific job vacancy
  .get(
    ":id",
    async ({ params, set }) => {
      try {
        const vacancy = await JobVacancyModel.findOne({
          vacancyId: params.id,
        }).lean();

        if (!vacancy) {
          set.status = 404;
          return {
            success: false,
            error: `Job vacancy with ID ${params.id} not found`,
          };
        }

        return {
          success: true,
          data: vacancy,
        };
      } catch (error) {
        console.error("Error getting job vacancy:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to get job vacancy";
        set.status = 500;
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    {
      detail: {
        summary: "Get Job Vacancy",
        description:
          "Gets a specific job vacancy by ID with all details including generated queries and standardized rubrics",
        tags: ["Job Vacancy"],
        responses: {
          200: {
            description: "Job vacancy retrieved successfully",
          },
          404: {
            description: "Job vacancy not found",
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
  )
  // PATCH /api/v1/job-vacancy/:id - Update job vacancy status
  .patch(
    ":id",
    async ({ params, body, set }) => {
      try {
        const { status } = body as { status?: "active" | "inactive" };

        if (!status || (status !== "active" && status !== "inactive")) {
          set.status = 400;
          return {
            success: false,
            error: "status must be either 'active' or 'inactive'",
          };
        }

        const vacancy = await JobVacancyModel.findOneAndUpdate(
          { vacancyId: params.id },
          { status, updatedAt: new Date() },
          { new: true }
        );

        if (!vacancy) {
          set.status = 404;
          return {
            success: false,
            error: `Job vacancy with ID ${params.id} not found`,
          };
        }

        return {
          success: true,
          vacancyId: vacancy.vacancyId,
          status: vacancy.status,
          message: "Job vacancy status updated successfully",
        };
      } catch (error) {
        console.error("Error updating job vacancy:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to update job vacancy";
        set.status = 500;
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    {
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
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
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
            description: "Job vacancy not found",
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
