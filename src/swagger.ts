import { openapi } from "@elysiajs/openapi";
import { env } from "./config/env";

export const swaggerPlugin = openapi({
  provider: "swagger-ui",
  path: "/swagger",

  documentation: {
    servers: [
      {
        description: "Local server",
        url: `http://localhost:${env.PORT}`,
      },
    ],
    info: {
      title: "CV Analyzer API",
      version: "1.0.0",
      description: "API for CV and project report evaluation using AI/LLM",
    },
    tags: [
      { name: "Upload", description: "File upload endpoints" },
      { name: "Evaluate", description: "Evaluation job endpoints" },
      { name: "Result", description: "Result retrieval endpoints" },
    ],
  },
});
