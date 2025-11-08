import { JobVacancyModel } from "../../../../models/job-vacancy.model";

export async function getJobVacancyHandler({
  id,
  set,
}: {
  id: string;
  set: { status?: number | string };
}) {
  try {
    const vacancy = await JobVacancyModel.findOne({
      vacancyId: id,
    }).lean();

    if (!vacancy) {
      set.status = 404;
      return {
        success: false,
        error: `Job vacancy with ID ${id} not found`,
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
}
