import {
  JobVacancyModel,
  IJobVacancy,
} from "../../../../models/job-vacancy.model";
import { FileModel, IFile } from "../../../../models/file.model";
import { getFilePath } from "../../../../services/storage.service";
import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";

/**
 * Extract text from PDF preserving line breaks for markdown formatting
 */
async function extractTextFromPDFWithLineBreaks(
  filePath: string
): Promise<string> {
  try {
    const dataBuffer = readFileSync(filePath);
    const pdfParse = new PDFParse({ data: dataBuffer });
    const parsed = await pdfParse.getText();
    // Return raw text with line breaks preserved
    return parsed.text;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Clean and format PDF content for markdown display
 * - Removes page markers like "-- 1 of 2 --"
 * - Preserves line breaks and formatting
 * - Normalizes whitespace appropriately
 */
function formatPDFContentForMarkdown(content: string): string {
  // Remove page markers (e.g., "-- 1 of 2 --", "-- 2 of 2 --", "-- 1 of 1 --")
  let cleaned = content.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "");

  // Remove standalone page markers (e.g., "1 of 2", "2 of 2")
  cleaned = cleaned.replace(/\b\d+\s+of\s+\d+\b/gi, "");

  // Normalize multiple spaces to single space (but preserve line breaks)
  cleaned = cleaned.replace(/[ \t]+/g, " ");

  // Normalize multiple line breaks (keep max 2 consecutive line breaks)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim each line
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove leading/trailing whitespace
  return cleaned.trim();
}

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
        const rawContent = await extractTextFromPDFWithLineBreaks(filePath);
        const formattedContent = formatPDFContentForMarkdown(rawContent);

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
