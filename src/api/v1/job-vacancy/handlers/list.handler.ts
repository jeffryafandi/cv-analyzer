import { JobVacancyModel } from "../../../../models/job-vacancy.model";
import { JobType, JobVacancyStatus } from "../../../../types/common";

export async function listJobVacanciesHandler({
  query,
  set,
}: {
  query: Record<string, string | undefined>;
  set: { status?: number | string };
}) {
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
      error instanceof Error ? error.message : "Failed to list job vacancies";
    set.status = 500;
    return {
      success: false,
      error: errorMessage,
    };
  }
}
