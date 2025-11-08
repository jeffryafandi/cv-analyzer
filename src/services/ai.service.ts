import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { getEmbeddingFunction } from "./embedding.service";
import { JobType } from "../types/common";
import {
  FileType,
  DocumentTexts,
  EvaluationQueries,
  CVEvaluationResult,
  ProjectEvaluationResult,
  CVResults,
  ProjectResults,
  SummaryResult,
  VectorDBResultWithSimilarity,
  VectorDBResult,
  CollectionDocument,
  CollectionInfo,
  StandardizedRubric,
} from "../types/services";

// Initialize ChromaDB client
let chromaClient: ChromaClient | null = null;

const getChromaClient = (): ChromaClient => {
  if (!chromaClient) {
    // ChromaDB v3.x accepts host and port directly
    const url = new URL(env.CHROMA_URL);
    chromaClient = new ChromaClient({
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 8000,
    });
  }
  return chromaClient;
};

// Initialize Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

const getGeminiClient = (): GoogleGenerativeAI | null => {
  if (!env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return geminiClient;
};

/**
 * List all collections in ChromaDB
 * @returns Array of collection names
 */
export async function listCollections(): Promise<string[]> {
  const client = getChromaClient();
  try {
    const collections = await client.listCollections();
    return collections.map((col) => col.name);
  } catch (error) {
    console.error(
      "Error listing collections:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * Get all documents from a collection
 * @param collectionName - Name of the collection
 * @param limit - Maximum number of documents to return (optional)
 * @returns Array of documents with their IDs and metadata
 */
export async function getCollectionDocuments(
  collectionName: string,
  limit?: number
): Promise<CollectionDocument[]> {
  const client = getChromaClient();

  if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY or OPENROUTER_API_KEY is not set in the environment variables."
    );
  }

  const embedder = getEmbeddingFunction();

  try {
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: embedder,
    });

    // Get all documents from the collection
    const results = await collection.get({
      limit: limit,
    });

    const documents: Array<{
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (results.documents && results.ids) {
      for (let i = 0; i < results.documents.length; i++) {
        const id = results.ids[i] as string;
        const text = results.documents[i] as string;
        const metadata =
          results.metadatas && results.metadatas[i]
            ? (results.metadatas[i] as Record<string, unknown>)
            : undefined;

        documents.push({ id, text, metadata });
      }
    }

    return documents;
  } catch (error) {
    console.error(
      `Error getting documents from collection ${collectionName}:`,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * Get collection count and metadata
 * @param collectionName - Name of the collection
 * @returns Collection information including document count
 */
export async function getCollectionInfo(
  collectionName: string
): Promise<CollectionInfo> {
  const client = getChromaClient();

  if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY or OPENROUTER_API_KEY is not set in the environment variables."
    );
  }

  const embedder = getEmbeddingFunction();

  try {
    const collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: embedder,
    });

    const count = await collection.count();

    return {
      name: collectionName,
      count,
      metadata: collection.metadata,
    };
  } catch (error) {
    console.error(
      `Error getting collection info for ${collectionName}:`,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score (range: -1 to 1, typically 0 to 1 for normalized embeddings)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Query ChromaDB vector database for relevant chunks using cosine similarity
 * Uses ChromaDB's built-in cosine similarity search (like Python reference)
 * @param cvText - CV text to compare against documents
 * @param collectionNames - Array of collection names to search
 * @param topK - Number of results to return per collection
 * @param jobVacancyId - Optional job vacancy ID to filter results by metadata
 * @returns Array of retrieved text chunks with metadata and similarity scores
 */
export async function queryVectorDBWithCosineSimilarity(
  cvText: string,
  collectionNames: string[],
  topK: number = 5,
  jobVacancyId?: string
): Promise<VectorDBResultWithSimilarity[]> {
  const client = getChromaClient();
  const allResults: VectorDBResultWithSimilarity[] = [];

  if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY or OPENROUTER_API_KEY is not set in the environment variables."
    );
  }

  const embedder = getEmbeddingFunction();

  // Use ChromaDB's built-in query which uses cosine similarity internally
  // This is more efficient than manually calculating similarity for all documents
  for (const collectionName of collectionNames) {
    try {
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: embedder,
      });

      // Query ChromaDB - it uses cosine similarity internally
      // ChromaDB already has embeddings stored, so this is efficient
      const queryOptions: any = {
        queryTexts: [cvText],
        nResults: topK,
        include: ["documents", "metadatas", "distances"],
      };

      // Add metadata filter if jobVacancyId is provided
      if (jobVacancyId) {
        queryOptions.where = { jobVacancyId };
      }

      const results = await collection.query(queryOptions);

      if (results.documents && results.documents[0]) {
        const documents = results.documents[0] as string[];
        const metadatas = results.metadatas?.[0] || [];
        const distances = results.distances?.[0] || [];

        // Convert distances to similarity scores
        // For cosine distance: similarity = 1 - distance
        // (ChromaDB returns cosine distance, where 0 = identical, 1 = orthogonal)
        for (let i = 0; i < documents.length; i++) {
          const text = documents[i];
          const distance = distances[i] as number;
          const metadata =
            metadatas[i] && metadatas[i]
              ? (metadatas[i] as Record<string, unknown>)
              : undefined;

          // Convert cosine distance to similarity
          // Cosine distance ranges from 0 (identical) to 1 (orthogonal)
          // Similarity = 1 - distance (so 1 = identical, 0 = orthogonal)
          const similarity = 1 - distance;

          allResults.push({ text, metadata, similarity });
        }

        console.log(
          `   Retrieved ${documents.length} results from ${collectionName} with cosine similarity`
        );
      }
    } catch (error) {
      console.error(
        `Error querying collection ${collectionName} with cosine similarity:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Sort all results by similarity (descending) and return top K overall
  allResults.sort((a, b) => b.similarity - a.similarity);
  const finalResults = allResults.slice(0, topK);

  if (finalResults.length > 0) {
    console.log(
      `   Final top ${
        finalResults.length
      } results with similarity scores: ${finalResults
        .map((r) => r.similarity.toFixed(4))
        .join(", ")}`
    );
  }

  return finalResults;
}

/**
 * Query ChromaDB vector database for relevant chunks
 * @param query - Search query text
 * @param collectionNames - Array of collection names to search
 * @param topK - Number of results to return per collection
 * @param jobVacancyId - Optional job vacancy ID to filter results by metadata
 * @returns Array of retrieved text chunks with metadata
 */
export async function queryVectorDB(
  query: string,
  collectionNames: string[],
  topK: number = 5,
  jobVacancyId?: string
): Promise<VectorDBResult[]> {
  const client = getChromaClient();
  const allResults: VectorDBResult[] = [];

  if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY or OPENROUTER_API_KEY is not set in the environment variables."
    );
  }

  const embedder = getEmbeddingFunction();

  for (const collectionName of collectionNames) {
    try {
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: embedder,
      });

      const queryOptions: any = {
        queryTexts: [query],
        nResults: topK,
      };

      // Add metadata filter if jobVacancyId is provided
      if (jobVacancyId) {
        queryOptions.where = { jobVacancyId };
      }

      const results = await collection.query(queryOptions);

      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          const text = results.documents[0][i] as string;
          const metadata =
            results.metadatas && results.metadatas[0]
              ? (results.metadatas[0][i] as Record<string, unknown>)
              : undefined;

          allResults.push({ text, metadata });
        }
      }
    } catch (error) {
      console.error(
        `Error querying collection ${collectionName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return allResults;
}

/**
 * Call Google Gemini API
 * @param prompt - Prompt to send to the model
 * @returns Response text from Gemini
 */
export async function callGemini(prompt: string): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Gemini API key not configured");
  }

  try {
    const model = client.getGenerativeModel({ model: env.GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Gemini API error: ${errorMessage}`);
  }
}

/**
 * Call OpenRouter API as fallback
 * @param prompt - Prompt to send to the model
 * @param model - Model name (defaults to env.OPENROUTER_MODEL)
 * @returns Response text from OpenRouter
 */
export async function callOpenRouter(
  prompt: string,
  model?: string
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  const modelName = model || env.OPENROUTER_MODEL;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://github.com/cv-analyzer",
          "X-Title": "CV Analyzer",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`OpenRouter API error: ${errorMessage}`);
  }
}

/**
 * Call the preferred LLM based on environment configuration
 * @param prompt - Prompt to send
 * @returns Response text from LLM
 */
export async function callLLM(prompt: string): Promise<string> {
  const preferred = env.PREFERRED_AI_SERVICE;

  switch (preferred) {
    case "gemini":
      if (!env.GEMINI_API_KEY) {
        throw new Error(
          "Gemini is the preferred service, but no API key was provided."
        );
      }
      return callGemini(prompt);

    case "openrouter":
      if (!env.OPENROUTER_API_KEY) {
        throw new Error(
          "OpenRouter is the preferred service, but no API key was provided."
        );
      }
      return callOpenRouter(prompt);

    default:
      throw new Error(
        `Invalid PREFERRED_AI_SERVICE: ${preferred}. Check your environment variables.`
      );
  }
}

/**
 * Build prompt for CV evaluation with scoring rubric
 * @param cvText - Extracted CV text
 * @param retrievedChunks - Retrieved context chunks from vector DB
 * @returns Formatted prompt string
 */
export function buildCVEvaluationPrompt(
  cvText: string,
  retrievedChunks: VectorDBResult[]
): string {
  const context = retrievedChunks
    .map((chunk, idx) => `[Context ${idx + 1}]\n${chunk.text}`)
    .join("\n\n");

  return `You are an expert CV evaluator. Evaluate the following CV against the job requirements and scoring rubric provided in the context.

REFERENCE CONTEXT (Job Description and CV Scoring Rubric):
${context}

CANDIDATE CV TO EVALUATE:
${cvText}

INSTRUCTIONS:
1. Use the scoring rubric and job requirements from the reference context above to evaluate the CV.
2. Score each parameter on a 1-5 scale according to the rubric provided in the context.
3. The rubric should specify the parameters, weights, and scoring criteria. If the context contains a scoring rubric, follow it exactly.
4. Calculate scores for: Technical Skills Match, Experience Level, Relevant Achievements, and Cultural/Collaboration Fit.

RESPONSE FORMAT (JSON only, no markdown):
{
  "technical_skills": <number 1-5>,
  "experience_level": <number 1-5>,
  "achievements": <number 1-5>,
  "cultural_fit": <number 1-5>,
  "feedback": "<detailed feedback string explaining the scores and how they align with the rubric>"
}`;
}

/**
 * Build prompt for project evaluation with scoring rubric
 * @param reportText - Extracted project report text
 * @param retrievedChunks - Retrieved context chunks from vector DB
 * @returns Formatted prompt string
 */
export function buildProjectEvaluationPrompt(
  reportText: string,
  retrievedChunks: VectorDBResult[]
): string {
  const context = retrievedChunks
    .map((chunk, idx) => `[Context ${idx + 1}]\n${chunk.text}`)
    .join("\n\n");

  return `You are an expert project evaluator. Evaluate the following project report against the case study requirements and scoring rubric provided in the context.

REFERENCE CONTEXT (Case Study Brief and Project Scoring Rubric):
${context}

PROJECT REPORT TO EVALUATE:
${reportText}

INSTRUCTIONS:
1. FIRST, determine if the provided document is actually a project report deliverable. If it is a CV, resume, job description, or any other type of document that is NOT a project report, set "is_relevant" to false and provide feedback explaining why it's not relevant. Do NOT provide scores in this case.
2. If the document IS a project report, set "is_relevant" to true and proceed with evaluation.
3. Use the scoring rubric and case study requirements from the reference context above to evaluate the project.
4. Score each parameter on a 1-5 scale according to the rubric provided in the context.
5. The rubric should specify the parameters, weights, and scoring criteria. If the context contains a scoring rubric, follow it exactly.
6. Evaluate parameters such as: Correctness (Prompt & Chaining), Code Quality & Structure, Resilience & Error Handling, Documentation & Explanation, and Creativity/Bonus.

RESPONSE FORMAT (JSON only, no markdown):
{
  "is_relevant": <boolean - true if document is a project report, false otherwise>,
  "correctness": <number 1-5, only if is_relevant is true>,
  "code_quality": <number 1-5, only if is_relevant is true>,
  "resilience": <number 1-5, only if is_relevant is true>,
  "documentation": <number 1-5, only if is_relevant is true>,
  "creativity": <number 1-5, only if is_relevant is true>,
  "feedback": "<detailed feedback string explaining the scores and how they align with the rubric, or explaining why the document is not relevant>"
}`;
}

/**
 * Build prompt for overall summary
 * @param cvResults - CV evaluation results
 * @param projectResults - Project evaluation results (optional for cv_only jobs)
 * @returns Formatted prompt string
 */
export function buildSummaryPrompt(
  cvResults: CVResults,
  projectResults: ProjectResults | null
): string {
  const projectSection = projectResults
    ? `PROJECT EVALUATION:
Score: ${projectResults.project_score.toFixed(2)}/5
Scores: Correctness ${
        projectResults.project_detailed_scores?.correctness || "N/A"
      }, Code Quality ${
        projectResults.project_detailed_scores?.code_quality || "N/A"
      }, Resilience ${
        projectResults.project_detailed_scores?.resilience || "N/A"
      }, Documentation ${
        projectResults.project_detailed_scores?.documentation || "N/A"
      }, Creativity ${
        projectResults.project_detailed_scores?.creativity || "N/A"
      }
Feedback: ${projectResults.project_feedback}`
    : `PROJECT EVALUATION:
Not applicable - This is a CV-only evaluation.`;

  return `You are a hiring manager. Based on the CV evaluation${
    projectResults ? " and project evaluation" : ""
  } below, provide a concise overall summary (3-5 sentences) that includes:
- Key strengths of the candidate
- Notable gaps or areas for improvement
- Final recommendation

CV EVALUATION:
Match Rate: ${cvResults.cv_match_rate.toFixed(2)}
Scores: Technical Skills ${
    cvResults.cv_detailed_scores?.technical_skills || "N/A"
  }, Experience ${
    cvResults.cv_detailed_scores?.experience_level || "N/A"
  }, Achievements ${
    cvResults.cv_detailed_scores?.achievements || "N/A"
  }, Cultural Fit ${cvResults.cv_detailed_scores?.cultural_fit || "N/A"}
Feedback: ${cvResults.cv_feedback}

${projectSection}

RESPONSE FORMAT (JSON only, no markdown):
{
  "overall_summary": "<3-5 sentence summary with strengths, gaps, and recommendation>"
}`;
}

/**
 * Parse JSON response from LLM, handling markdown code blocks
 * @param response - Raw LLM response
 * @returns Parsed JSON object
 */
export function parseLLMResponse<T>(response: string): T {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    // Try to extract JSON from the response if it's embedded in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        throw new Error(
          `Failed to parse LLM response as JSON: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    throw new Error(
      `Failed to parse LLM response as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Generate evaluation queries from job documents using AI
 * Analyzes job description and rubrics to create optimal vector DB queries
 * @param documentTexts - Object containing extracted text from job documents
 * @param jobType - Type of job (cv_only | cv_with_test)
 * @returns Array of query strings for vector DB searches
 */
export async function generateEvaluationQueries(
  documentTexts: DocumentTexts,
  jobType: JobType
): Promise<EvaluationQueries> {
  const prompt = `You are an expert at creating semantic search queries for vector databases. Analyze the following job documents and generate optimal search queries that will help retrieve the most relevant context for evaluating candidates.

JOB DOCUMENTS:
${
  documentTexts.jobDescription
    ? `Job Description:\n${documentTexts.jobDescription}\n\n`
    : ""
}
${
  documentTexts.cvRubric
    ? `CV Scoring Rubric:\n${documentTexts.cvRubric}\n\n`
    : ""
}
${
  documentTexts.caseStudyBrief
    ? `Case Study Brief:\n${documentTexts.caseStudyBrief}\n\n`
    : ""
}
${
  documentTexts.projectRubric
    ? `Project Scoring Rubric:\n${documentTexts.projectRubric}\n\n`
    : ""
}

JOB TYPE: ${jobType}

INSTRUCTIONS:
1. For CV evaluation, generate 3-5 concise query strings that capture key requirements, skills, and evaluation criteria from the job description and CV rubric.
2. Each query should be optimized for semantic search in a vector database.
3. Queries should focus on: technical skills, experience requirements, achievements, cultural fit, and any specific job requirements.
4. ${
    jobType === "cv_with_test"
      ? "For project evaluation, generate 3-5 query strings that capture project requirements, implementation criteria, code quality standards, and evaluation metrics from the case study brief and project rubric."
      : ""
  }

RESPONSE FORMAT (JSON only, no markdown):
{
  "cvEvaluationQueries": ["query 1", "query 2", "query 3"],
  ${
    jobType === "cv_with_test"
      ? '"projectEvaluationQueries": ["query 1", "query 2", "query 3"]'
      : ""
  }
}

Generate queries that are specific, focused, and will retrieve the most relevant context chunks for evaluation.`;

  const response = await callLLM(prompt);
  const parsed = parseLLMResponse<{
    cvEvaluationQueries: string[];
    projectEvaluationQueries?: string[];
  }>(response);

  return {
    cvEvaluationQueries: parsed.cvEvaluationQueries || [],
    projectEvaluationQueries: parsed.projectEvaluationQueries,
  };
}

/**
 * Standardize a user-provided rubric using AI
 * Converts user input (even simple descriptions) into a structured rubric
 * @param userRubricText - Raw rubric text from user upload
 * @param rubricType - Type of rubric (cv | project)
 * @param jobDescription - Optional job description for context
 * @returns Standardized rubric structure
 */
export async function standardizeRubric(
  userRubricText: string,
  rubricType: "cv" | "project",
  jobDescription?: string
): Promise<StandardizedRubric> {
  const prompt = `You are an expert at creating standardized evaluation rubrics. Convert the following user-provided rubric into a structured, standardized format.

${jobDescription ? `JOB DESCRIPTION (for context):\n${jobDescription}\n\n` : ""}
USER RUBRIC:
${userRubricText}

RUBRIC TYPE: ${rubricType}

INSTRUCTIONS:
1. Analyze the user's rubric (even if it's just a simple description like "strong in A") and extract key evaluation criteria.
2. Create a standardized rubric with the following structure:
   ${
     rubricType === "cv"
       ? `- technical_skills: Weight 0.4, with 1-5 scale descriptions
   - experience_level: Weight 0.25, with 1-5 scale descriptions
   - achievements: Weight 0.2, with 1-5 scale descriptions
   - cultural_fit: Weight 0.15, with 1-5 scale descriptions`
       : `- correctness: Weight 0.3, with 1-5 scale descriptions
   - code_quality: Weight 0.25, with 1-5 scale descriptions
   - resilience: Weight 0.2, with 1-5 scale descriptions
   - documentation: Weight 0.15, with 1-5 scale descriptions
   - creativity: Weight 0.1, with 1-5 scale descriptions`
   }
3. Each parameter should have:
   - weight: A number (weights should sum to 1.0)
   - criteria: Clear description of what this parameter evaluates
   - scale: An object with keys 1-5, each containing a description of what that score means
4. If the user's rubric is vague or incomplete, infer reasonable criteria based on the job description and best practices.
5. Make the rubric straightforward, clear, and actionable.

RESPONSE FORMAT (JSON only, no markdown):
${
  rubricType === "cv"
    ? `{
  "technical_skills": {
    "weight": 0.4,
    "criteria": "description of what technical skills are evaluated",
    "scale": {
      "1": "description of score 1",
      "2": "description of score 2",
      "3": "description of score 3",
      "4": "description of score 4",
      "5": "description of score 5"
    }
  },
  "experience_level": {
    "weight": 0.25,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "achievements": {
    "weight": 0.2,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "cultural_fit": {
    "weight": 0.15,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  }
}`
    : `{
  "correctness": {
    "weight": 0.3,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "code_quality": {
    "weight": 0.25,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "resilience": {
    "weight": 0.2,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "documentation": {
    "weight": 0.15,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  },
  "creativity": {
    "weight": 0.1,
    "criteria": "description",
    "scale": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "..."}
  }
}`
}`;

  const response = await callLLM(prompt);
  return parseLLMResponse(response);
}
