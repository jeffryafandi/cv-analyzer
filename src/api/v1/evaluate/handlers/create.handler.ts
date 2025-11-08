import { JobModel } from "../../../../models/job.model";
import { JobVacancyModel } from "../../../../models/job-vacancy.model";
import { FileModel } from "../../../../models/file.model";
import { addEvaluationJob } from "../../../../jobs/evaluation.queue";
import { randomUUID } from "crypto";

export async function createEvaluationHandler({
  body,
  set,
}: {
  body: { vacancyId: string; cvId: string; reportId?: string };
  set: { status?: number | string };
}) {
  try {
    const { vacancyId, cvId, reportId } = body;

    // Validate vacancy exists and is active
    const vacancy = await JobVacancyModel.findOne({ vacancyId });
    if (!vacancy) {
      set.status = 404;
      return {
        success: false,
        error: `Job vacancy with ID ${vacancyId} not found`,
      };
    }

    if (vacancy.status !== "active") {
      set.status = 400;
      return {
        success: false,
        error: `Job vacancy with ID ${vacancyId} is not active`,
      };
    }

    // Validate CV file exists
    const cvFile = await FileModel.findById(cvId);
    if (!cvFile) {
      set.status = 404;
      return {
        success: false,
        error: `CV file with ID ${cvId} not found`,
      };
    }

    // Validate report file if provided or required
    let reportFile = null;
    if (reportId) {
      reportFile = await FileModel.findById(reportId);
      if (!reportFile) {
        set.status = 404;
        return {
          success: false,
          error: `Report file with ID ${reportId} not found`,
        };
      }
    }

    // Validate report requirement based on vacancy type
    if (vacancy.type === "cv_with_test" && !reportId) {
      set.status = 400;
      return {
        success: false,
        error: "reportId is required for cv_with_test job vacancies",
      };
    }

    // Generate unique job ID
    const jobId = randomUUID();

    // Prepare file IDs array
    const fileIds = reportId ? [cvId, reportId] : [cvId];

    // Create job document in MongoDB
    const job = await JobModel.create({
      jobId,
      status: "queued",
      fileIds,
      vacancyId,
    });

    // Add job to BullMQ queue
    await addEvaluationJob({
      jobId,
      cvId,
      reportId: reportId || "",
      vacancyId,
    });

    return {
      id: jobId,
      status: "queued",
    };
  } catch (error) {
    console.error("Error creating evaluation job:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create evaluation job";
    set.status = 500;
    return {
      success: false,
      error: errorMessage,
    };
  }
}
