import { Elysia } from "elysia";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { uploadController } from "./api/upload.controller";
import { evaluateController } from "./api/evaluate.controller";
import { resultController } from "./api/result.controller";
import { swaggerPlugin } from "./swagger";

// Initialize Elysia app
const app = new Elysia()
  .get("/", () => ({
    message: "CV Analyzer API",
    version: "1.0.0",
    endpoints: {
      upload: "POST /upload",
      evaluate: "POST /evaluate",
      result: "GET /result/:id",
    },
  }))
  .use(uploadController)
  .use(evaluateController)
  .use(resultController)
  .use(swaggerPlugin)
  .onError(({ code, error }) => {
    console.error(`Error: ${code}`, error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error) || "Internal server error";
    return {
      success: false,
      error: errorMessage,
    };
  });

// Connect to MongoDB and Redis on startup
Promise.all([connectDB(), connectRedis()])
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`🦊 Elysia is running at http://localhost:${env.PORT}`);
      console.log(
        `📚 API Documentation available at http://localhost:${env.PORT}/swagger`
      );
    });
  })
  .catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
