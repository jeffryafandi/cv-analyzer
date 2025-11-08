import { openapi } from "@elysiajs/openapi";
import { env } from "./config/env";

export const swaggerPlugin = openapi({
  provider: "swagger-ui",
  path: "/api-docs",
  exclude: {
    paths: [
      "/",
      "/admin/queues/api/redis/stats",
      "/admin/queues/api/queues",
      "/admin/queues/api/queues/pause",
      "/admin/queues/api/queues/resume",
      "/admin/queues/api/queues/:queueName/:jobId/logs",
      "/admin/queues/api/queues/:queueName/:jobId",
      "/admin/queues/api/queues/:queueName/add",
      "/admin/queues/api/queues/:queueName/retry/:queueStatus",
      "/admin/queues/api/queues/:queueName/promote",
      "/admin/queues/api/queues/:queueName/clean/:queueStatus",
      "/admin/queues/api/queues/:queueName/pause",
      "/admin/queues/api/queues/:queueName/resume",
      "/admin/queues/api/queues/:queueName/empty",
      "/admin/queues/api/queues/:queueName/:jobId/retry/:queueStatus",
      "/admin/queues/api/queues/:queueName/:jobId/clean",
      "/admin/queues/api/queues/:queueName/:jobId/promote",
      "/admin/queues/api/queues/:queueName/:jobId/update-data",
      "/admin/queues/",
      "/admin/queues/queue/:queueName",
      "/admin/queues/queue/:queueName/:jobId",
      "/admin/queues/static/css",
      "/admin/queues/static/images",
      "/admin/queues/static/js",
      "/admin/queues/static/locales",
      "/admin/queues/static/locales/da-DK",
      "/admin/queues/static/locales/en-GB",
      "/admin/queues/static/locales/en-US",
      "/admin/queues/static/locales/es-ES",
      "/admin/queues/static/locales/fr-FR",
      "/admin/queues/static/locales/ja-JP",
      "/admin/queues/static/locales/ko-KR",
      "/admin/queues/static/locales/pt-BR",
      "/admin/queues/static/locales/tr-TR",
      "/admin/queues/static/locales/zh-CN",
      "/admin/queues/static/js/async",
      "/admin/queues/static/css/async",
    ],
  },

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
