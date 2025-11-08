import { Elysia } from "elysia";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { uploadController } from "./api/upload.controller";
import { evaluateController } from "./api/evaluate.controller";
import { resultController } from "./api/result.controller";
import { swaggerPlugin } from "./swagger";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { getEvaluationQueue } from "./jobs/evaluation.queue";

// Create server adapter first
const serverAdapter = new ElysiaAdapter("/admin/queues");

// Function to initialize the app after Redis is connected
async function startServer() {
  // Connect to MongoDB and Redis first
  await Promise.all([connectDB(), connectRedis()]);

  // Setup Bull Board after Redis is connected
  createBullBoard({
    queues: [new BullMQAdapter(getEvaluationQueue())],
    serverAdapter,

    options: {
      uiBasePath: "node_modules/@bull-board/ui",
    },
  });

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
    .onBeforeHandle(({ request, set, path }) => {
      // Only apply authentication to bull-board routes
      if (path.startsWith("/admin/queues")) {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
          set.headers["WWW-Authenticate"] = 'Basic realm="Restricted Area"';
          set.status = 401;
          return "Authentication required.";
        }
        const base64Credentials = authHeader.split(" ")[1];
        const credentials = Buffer.from(base64Credentials, "base64").toString(
          "ascii"
        );
        const [username, password] = credentials.split(":");
        if (
          username !== env.BULL_BOARD_USERNAME ||
          password !== env.BULL_BOARD_PASSWORD
        ) {
          set.headers["WWW-Authenticate"] = 'Basic realm="Restricted Area"';
          set.status = 401;
          return "Invalid credentials.";
        }
      }
    })
    .use(serverAdapter.registerPlugin())
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

  app.listen(env.PORT, () => {
    console.log(`🦊 Elysia is running at http://localhost:${env.PORT}`);
    console.log(
      `📚 API Documentation available at http://localhost:${env.PORT}/api-docs`
    );
    console.log(
      `📊 Bull Board available at http://localhost:${env.PORT}/admin/queues`
    );
  });
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
