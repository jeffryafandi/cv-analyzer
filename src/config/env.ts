import { z } from "zod";

const envSchema = z
  .object({
    MONGODB_URI: z
      .string()
      .url()
      .default("mongodb://localhost:27017/cv-analyzer"),
    REDIS_URI: z.string().url().default("redis://localhost:6379"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z
      .string()
      .default("3000")
      .transform((val) => Number(val)),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default("deepseek/deepseek-chat-v3.1:free"),
    OPENROUTER_EMBEDDING_MODEL: z.string().default("qwen/qwen3-embedding-8b"),
    CHROMA_URL: z.string().url().default("http://localhost:8000"),
    PREFERRED_AI_SERVICE: z.enum(["gemini", "openrouter"]).default("gemini"),
    BULL_BOARD_USERNAME: z.string().default("admin"),
    BULL_BOARD_PASSWORD: z.string().default("admin"),
  })
  .refine(
    (data) => {
      return !(
        (data.PREFERRED_AI_SERVICE === "gemini" && !data.GEMINI_API_KEY) ||
        (data.PREFERRED_AI_SERVICE === "openrouter" && !data.OPENROUTER_API_KEY)
      );
    },
    {
      message:
        "API key for the preferred service must be provided. If PREFERRED_AI_SERVICE is 'gemini', GEMINI_API_KEY is required. If 'openrouter', OPENROUTER_API_KEY is required.",
    }
  )
  .refine(
    (data) => {
      return data.GEMINI_API_KEY || data.OPENROUTER_API_KEY;
    },
    {
      message:
        "At least one of GEMINI_API_KEY or OPENROUTER_API_KEY must be provided.",
    }
  );

const parseEnv = () => {
  try {
    return envSchema.parse({
      MONGODB_URI: process.env.MONGODB_URI,
      REDIS_URI: process.env.REDIS_URI,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      OPENROUTER_EMBEDDING_MODEL: process.env.OPENROUTER_EMBEDDING_MODEL,
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
      CHROMA_URL: process.env.CHROMA_URL,
      PREFERRED_AI_SERVICE: process.env.PREFERRED_AI_SERVICE,
      BULL_BOARD_USERNAME: process.env.BULL_BOARD_USERNAME,
      BULL_BOARD_PASSWORD: process.env.BULL_BOARD_PASSWORD,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:");
      error.issues.forEach((err: z.ZodIssue) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();
