import { JobModel } from "../../../../models/job.model";

export async function getResultHandler({
  id,
  set,
}: {
  id: string;
  set: { status?: number | string };
}) {
  try {
    const job = await JobModel.findOne({ jobId: id });

    if (!job) {
      set.status = 404;
      return {
        success: false,
        error: `Job with ID ${id} not found`,
      };
    }

    // If job is queued or processing, return status only
    if (job.status === "queued" || job.status === "processing") {
      return {
        id: job.jobId,
        status: job.status,
      };
    }

    // If job is completed, return full result
    if (job.status === "completed" && job.result) {
      return {
        id: job.jobId,
        status: job.status,
        result: job.result,
      };
    }

    // If job failed, return error
    if (job.status === "failed") {
      return {
        id: job.jobId,
        status: job.status,
        error: job.error || "Evaluation failed",
      };
    }

    return {
      id: job.jobId,
      status: job.status,
    };
  } catch (error) {
    console.error("Error retrieving evaluation result:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to retrieve evaluation result";
    set.status = 500;
    return {
      success: false,
      error: errorMessage,
    };
  }
}
