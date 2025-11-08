import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { getEmbeddingFunction } from "./embedding.service";

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
): Promise<
  Array<{
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>
> {
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
export async function getCollectionInfo(collectionName: string): Promise<{
  name: string;
  count: number;
  metadata?: Record<string, unknown>;
}> {
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
 * @returns Array of retrieved text chunks with metadata and similarity scores
 */
export async function queryVectorDBWithCosineSimilarity(
  cvText: string,
  collectionNames: string[],
  topK: number = 5
): Promise<
  Array<{
    text: string;
    metadata?: Record<string, unknown>;
    similarity: number;
  }>
> {
  const client = getChromaClient();
  const allResults: Array<{
    text: string;
    metadata?: Record<string, unknown>;
    similarity: number;
  }> = [];

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
      const results = await collection.query({
        queryTexts: [cvText],
        nResults: topK,
        include: ["documents", "metadatas", "distances"],
      });

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
 * @returns Array of retrieved text chunks with metadata
 */
export async function queryVectorDB(
  query: string,
  collectionNames: string[],
  topK: number = 5
): Promise<Array<{ text: string; metadata?: Record<string, unknown> }>> {
  const client = getChromaClient();
  const allResults: Array<{
    text: string;
    metadata?: Record<string, unknown>;
  }> = [];

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

      const results = await collection.query({
        queryTexts: [query],
        nResults: topK,
      });

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
  retrievedChunks: Array<{ text: string; metadata?: Record<string, unknown> }>
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
  retrievedChunks: Array<{ text: string; metadata?: Record<string, unknown> }>
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
1. Use the scoring rubric and case study requirements from the reference context above to evaluate the project.
2. Score each parameter on a 1-5 scale according to the rubric provided in the context.
3. The rubric should specify the parameters, weights, and scoring criteria. If the context contains a scoring rubric, follow it exactly.
4. Evaluate parameters such as: Correctness (Prompt & Chaining), Code Quality & Structure, Resilience & Error Handling, Documentation & Explanation, and Creativity/Bonus.

RESPONSE FORMAT (JSON only, no markdown):
{
  "correctness": <number 1-5>,
  "code_quality": <number 1-5>,
  "resilience": <number 1-5>,
  "documentation": <number 1-5>,
  "creativity": <number 1-5>,
  "feedback": "<detailed feedback string explaining the scores and how they align with the rubric>"
}`;
}

/**
 * Build prompt for overall summary
 * @param cvResults - CV evaluation results
 * @param projectResults - Project evaluation results
 * @returns Formatted prompt string
 */
export function buildSummaryPrompt(
  cvResults: {
    cv_match_rate: number;
    cv_feedback: string;
    cv_detailed_scores?: {
      technical_skills: number;
      experience_level: number;
      achievements: number;
      cultural_fit: number;
    };
  },
  projectResults: {
    project_score: number;
    project_feedback: string;
    project_detailed_scores?: {
      correctness: number;
      code_quality: number;
      resilience: number;
      documentation: number;
      creativity: number;
    };
  }
): string {
  return `You are a hiring manager. Based on the CV and project evaluations below, provide a concise overall summary (3-5 sentences) that includes:
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

PROJECT EVALUATION:
Score: ${projectResults.project_score.toFixed(2)}/5
Scores: Correctness ${
    projectResults.project_detailed_scores?.correctness || "N/A"
  }, Code Quality ${
    projectResults.project_detailed_scores?.code_quality || "N/A"
  }, Resilience ${
    projectResults.project_detailed_scores?.resilience || "N/A"
  }, Documentation ${
    projectResults.project_detailed_scores?.documentation || "N/A"
  }, Creativity ${projectResults.project_detailed_scores?.creativity || "N/A"}
Feedback: ${projectResults.project_feedback}

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
