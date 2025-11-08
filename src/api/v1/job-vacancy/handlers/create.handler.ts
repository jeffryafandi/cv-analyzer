import { JobVacancyModel } from "../../../../models/job-vacancy.model";
import { FileModel } from "../../../../models/file.model";
import { saveFile } from "../../../../services/storage.service";
import { addJobVacancyIngestionJob } from "../../../../jobs/job-vacancy-ingestion.queue";
import { randomUUID } from "crypto";
import { JobType } from "../../../../types/common";

export async function createJobVacancyHandler({
  request,
  set,
}: {
  request: Request;
  set: { status?: number | string };
}) {
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
    const jobDescriptionFile = formData.get("jobDescription") as File | null;
    const cvRubricFile = formData.get("cvRubric") as File | null;
    const caseStudyBriefFile = formData.get("caseStudyBrief") as File | null;
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
    const { filePath: jobDescPath, filename: jobDescFilename } = await saveFile(
      jobDescriptionFile,
      "job_description"
    );
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

    if (type === "cv_with_test" && caseStudyBriefFile && projectRubricFile) {
      const { filePath: caseStudyPath, filename: caseStudyFilename } =
        await saveFile(caseStudyBriefFile, "case_study_brief");
      const { filePath: projectRubricPath, filename: projectRubricFilename } =
        await saveFile(projectRubricFile, "project_rubric");

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
      error instanceof Error ? error.message : "Failed to create job vacancy";
    set.status = 500;
    return {
      success: false,
      error: errorMessage,
    };
  }
}
