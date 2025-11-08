import { JobVacancyModel } from "../../../../models/job-vacancy.model";
import { JobType, JobVacancyStatus } from "../../../../types/common";
import {
  parsePaginationParams,
  createPaginationResponse,
} from "../../../utils/pagination.util";

export async function listJobVacanciesHandler({
  query,
  set,
}: {
  query: {
    status?: JobVacancyStatus;
    type?: JobType;
    page?: number;
    limit?: number;
  };
  set: { status?: number | string };
}) {
  try {
    const status = query.status;
    const type = query.type;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

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
      .select("vacancyId title description type status")
      .lean();

    // Transform data to use vacancyId as id and remove _id
    const transformedVacancies = vacancies.map((vacancy) => ({
      id: vacancy.vacancyId,
      title: vacancy.title,
      description: vacancy.description,
      type: vacancy.type,
      status: vacancy.status,
    }));

    const { data, pagination } = createPaginationResponse(
      transformedVacancies,
      total,
      page,
      limit
    );

    return {
      success: true,
      data,
      pagination,
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
