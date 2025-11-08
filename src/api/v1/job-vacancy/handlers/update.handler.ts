import { JobVacancyModel } from "../../../../models/job-vacancy.model";

export async function updateJobVacancyHandler({
  id,
  body,
  set,
}: {
  id: string;
  body: { status?: "active" | "inactive" };
  set: { status?: number | string };
}) {
  try {
    const { status } = body;

    if (!status || (status !== "active" && status !== "inactive")) {
      set.status = 400;
      return {
        success: false,
        error: "status must be either 'active' or 'inactive'",
      };
    }

    const vacancy = await JobVacancyModel.findOneAndUpdate(
      { vacancyId: id },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!vacancy) {
      set.status = 404;
      return {
        success: false,
        error: `Job vacancy with ID ${id} not found`,
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
      error instanceof Error ? error.message : "Failed to update job vacancy";
    set.status = 500;
    return {
      success: false,
      error: errorMessage,
    };
  }
}
