import { ChromaClient } from "chromadb";
import { env } from "../config/env";
import { getEmbeddingFunction } from "./embedding.service";
import { extractTextFromPDF, chunkText } from "./pdf.service";
import { getFilePath } from "./storage.service";
import { FileModel } from "../models/file.model";
import { generateEvaluationQueries, standardizeRubric } from "./ai.service";
import { JobType } from "../types/common";
import {
  JobVacancyIngestionResult,
  StandardizedRubric,
} from "../types/services";

// Collection names for shared collections
const COLLECTIONS = {
  JOB_DOCUMENTS: "job_documents",
  CV_RUBRICS: "cv_rubrics",
  PROJECT_RUBRICS: "project_rubrics",
  CASE_STUDIES: "case_studies",
};

// Map file types to collections
const FILE_TYPE_TO_COLLECTION: Record<string, string> = {
  job_description: COLLECTIONS.JOB_DOCUMENTS,
  cv_rubric: COLLECTIONS.CV_RUBRICS,
  project_rubric: COLLECTIONS.PROJECT_RUBRICS,
  case_study_brief: COLLECTIONS.CASE_STUDIES,
};

/**
 * Get or initialize ChromaDB client
 */
function getChromaClient(): ChromaClient {
  const url = new URL(env.CHROMA_URL);
  return new ChromaClient({
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 8000,
  });
}

/**
 * Ingest a single PDF file into ChromaDB with job vacancy metadata
 */
async function ingestPDFToChromaDB(
  client: ChromaClient,
  fileId: string,
  jobVacancyId: string,
  documentType: string
): Promise<string> {
  // Get file document
  const fileDoc = await FileModel.findById(fileId);
  if (!fileDoc) {
    throw new Error(`File with ID ${fileId} not found`);
  }

  // Get collection name
  const collectionName = FILE_TYPE_TO_COLLECTION[documentType];
  if (!collectionName) {
    throw new Error(`Unknown document type: ${documentType}`);
  }

  // Extract text from PDF
  const filePath = getFilePath(fileDoc.filename);
  const text = await extractTextFromPDF(filePath);
  if (!text || text.trim().length === 0) {
    throw new Error(
      `File ${fileDoc.filename} appears to be empty or unreadable`
    );
  }

  // Chunk the text
  const chunks = await chunkText(text, 1000, 2);
  console.log(`   Split ${fileDoc.filename} into ${chunks.length} chunks`);

  const embedder = getEmbeddingFunction();

  // Get or create collection
  const collection = await client.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: embedder,
  });

  // Prepare documents, metadatas, and IDs
  const documents: string[] = [];
  const metadatas: Array<Record<string, string | number | boolean | null>> = [];
  const ids: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = `${jobVacancyId}_${documentType}_${fileId}_chunk_${i}`;

    documents.push(chunk);
    metadatas.push({
      jobVacancyId,
      documentType,
      source: fileDoc.filename,
      chunk_index: i,
      total_chunks: chunks.length,
    });
    ids.push(chunkId);
  }

  // Add to collection
  await collection.add({
    ids,
    documents,
    metadatas,
  });

  console.log(
    `✅ Successfully ingested ${chunks.length} chunks from ${fileDoc.filename} to ${collectionName}`
  );

  return text;
}

/**
 * Process and ingest a job vacancy
 * Extracts text, ingests to ChromaDB, generates queries, and standardizes rubrics
 */
export async function ingestJobVacancy(
  jobVacancyId: string,
  jobDescriptionFileId: string,
  cvRubricFileId: string,
  caseStudyBriefFileId?: string,
  projectRubricFileId?: string,
  jobType: JobType = "cv_only"
): Promise<JobVacancyIngestionResult> {
  console.log(`🚀 Starting ingestion for job vacancy ${jobVacancyId}`);

  const client = getChromaClient();

  // Check ChromaDB connection
  try {
    await client.heartbeat();
    console.log("✅ ChromaDB connection successful");
  } catch (error) {
    throw new Error(
      `Failed to connect to ChromaDB: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Extract and ingest all documents
  console.log("📄 Extracting and ingesting documents...");
  const jobDescriptionText = await ingestPDFToChromaDB(
    client,
    jobDescriptionFileId,
    jobVacancyId,
    "job_description"
  );

  const cvRubricText = await ingestPDFToChromaDB(
    client,
    cvRubricFileId,
    jobVacancyId,
    "cv_rubric"
  );

  let caseStudyBriefText: string | undefined;
  let projectRubricText: string | undefined;

  if (jobType === "cv_with_test") {
    if (!caseStudyBriefFileId || !projectRubricFileId) {
      throw new Error(
        "caseStudyBriefFileId and projectRubricFileId are required for cv_with_test type"
      );
    }

    caseStudyBriefText = await ingestPDFToChromaDB(
      client,
      caseStudyBriefFileId,
      jobVacancyId,
      "case_study_brief"
    );

    projectRubricText = await ingestPDFToChromaDB(
      client,
      projectRubricFileId,
      jobVacancyId,
      "project_rubric"
    );
  }

  // Generate evaluation queries using AI
  console.log("🤖 Generating evaluation queries using AI...");
  const documentTexts = {
    jobDescription: jobDescriptionText,
    cvRubric: cvRubricText,
    caseStudyBrief: caseStudyBriefText,
    projectRubric: projectRubricText,
  };

  const queries = await generateEvaluationQueries(documentTexts, jobType);
  console.log(
    `✅ Generated ${queries.cvEvaluationQueries.length} CV evaluation queries`
  );
  if (queries.projectEvaluationQueries) {
    console.log(
      `✅ Generated ${queries.projectEvaluationQueries.length} project evaluation queries`
    );
  }

  // Standardize rubrics using AI
  console.log("🤖 Standardizing rubrics using AI...");
  const standardizedCvRubric = await standardizeRubric(
    cvRubricText,
    "cv",
    jobDescriptionText
  );
  console.log("✅ Standardized CV rubric");

  let standardizedProjectRubric: StandardizedRubric | undefined;
  if (jobType === "cv_with_test" && projectRubricText) {
    standardizedProjectRubric = await standardizeRubric(
      projectRubricText,
      "project",
      caseStudyBriefText
    );
    console.log("✅ Standardized project rubric");
  }

  console.log(`✨ Ingestion complete for job vacancy ${jobVacancyId}`);

  return {
    jobDescriptionText,
    cvRubricText,
    caseStudyBriefText,
    projectRubricText,
    cvEvaluationQueries: queries.cvEvaluationQueries,
    projectEvaluationQueries: queries.projectEvaluationQueries,
    standardizedCvRubric,
    standardizedProjectRubric,
  };
}
