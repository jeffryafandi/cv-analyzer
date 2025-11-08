import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { EmbeddingFunction } from "chromadb";
import { env } from "../config/env";

export class GoogleGenerativeAiEmbeddingFunction implements EmbeddingFunction {
  private api: GoogleGenerativeAI;
  private model: string;

  constructor({
    apiKey,
    model = env.GEMINI_EMBEDDING_MODEL,
  }: {
    apiKey: string;
    model?: string;
  }) {
    this.api = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const model = this.api.getGenerativeModel({ model: this.model });

    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }], role: "user" },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      })),
    });

    return result.embeddings.map((e) => e.values);
  }
}

export class OpenRouterEmbeddingFunction implements EmbeddingFunction {
  private model: string;

  constructor({ model }: { model: string }) {
    this.model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OpenRouter API key not configured");
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter Embedding API error: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      return data.data.map((d: { embedding: number[] }) => d.embedding);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`OpenRouter Embedding API error: ${errorMessage}`);
    }
  }
}

export function getEmbeddingFunction(): EmbeddingFunction {
  const preferred = env.PREFERRED_AI_SERVICE;

  switch (preferred) {
    case "gemini":
      if (!env.GEMINI_API_KEY) {
        // This should not happen due to env validation, but as a safeguard:
        throw new Error(
          "Gemini is the preferred service, but no API key was provided."
        );
      }
      return new GoogleGenerativeAiEmbeddingFunction({
        apiKey: env.GEMINI_API_KEY,
      });

    case "openrouter":
      if (!env.OPENROUTER_API_KEY) {
        // This should not happen due to env validation, but as a safeguard:
        throw new Error(
          "OpenRouter is the preferred service, but no API key was provided."
        );
      }
      return new OpenRouterEmbeddingFunction({
        model: env.OPENROUTER_EMBEDDING_MODEL,
      });

    default:
      // This case should be impossible if zod enum validation is correct
      throw new Error(
        `Invalid PREFERRED_AI_SERVICE: ${preferred}. Check your environment variables.`
      );
  }
}
