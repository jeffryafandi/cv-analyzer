import {
  JobVacancyModel,
  IJobVacancy,
} from "../../../../models/job-vacancy.model";
import { FileModel, IFile } from "../../../../models/file.model";
import { getFilePath } from "../../../../services/storage.service";
import { extractAndFormatPDFForMarkdown } from "../../../../services/pdf.service";

export async function getJobVacancyHandler({
  id,
  set,
}: {
  id: string;
  set: { status?: number | string };
}) {
  try {
    const vacancy = (await JobVacancyModel.findOne({
      vacancyId: id,
    }).lean()) as IJobVacancy | null;

    if (!vacancy) {
      set.status = 404;
      return {
        success: false,
        error: `Job vacancy with ID ${id} not found`,
      };
    }

    // Helper function to get file content (returns only the formatted content string)
    const getFileContent = async (
      fileId: string | undefined
    ): Promise<string | null> => {
      if (!fileId) return null;
      try {
        const fileDoc = (await FileModel.findById(
          fileId
        ).lean()) as IFile | null;
        if (!fileDoc) return null;

        const filePath = getFilePath(fileDoc.filename);
        const formattedContent = await extractAndFormatPDFForMarkdown(filePath);

        return formattedContent;
      } catch (error) {
        console.error(`Error reading file ${fileId}:`, error);
        return null;
      }
    };

    // Map file references to actual file data
    const [jobDescription, cvRubric, caseStudyBrief, projectRubric] =
      await Promise.all([
        getFileContent(vacancy.jobDescriptionFileId),
        getFileContent(vacancy.cvRubricFileId),
        getFileContent(vacancy.caseStudyBriefFileId),
        getFileContent(vacancy.projectRubricFileId),
      ]);

    // Transform response
    const response: Record<string, unknown> = {
      id: vacancy.vacancyId,
      title: vacancy.title,
      description: vacancy.description,
      type: vacancy.type,
      status: vacancy.status,
      jobDescription: jobDescription,
      cvRubric: cvRubric,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
    };

    // Add optional fields if they exist
    if (caseStudyBrief) {
      response.caseStudyBrief = caseStudyBrief;
    }
    if (projectRubric) {
      response.projectRubric = projectRubric;
    }

    return {
      success: true,
      data: response,
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
